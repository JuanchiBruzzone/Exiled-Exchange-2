#include "NativeServer.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonValue>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QSaveFile>
#include <QStandardPaths>
#include <QStringDecoder>
#include <QUrl>

#include <limits>

namespace {
QByteArray reasonPhrase(int status) {
  switch (status) {
  case 200:
    return "OK";
  case 101:
    return "Switching Protocols";
  case 404:
    return "Not Found";
  case 502:
    return "Bad Gateway";
  default:
    return "Error";
  }
}

QByteArray webSocketAccept(const QByteArray &key) {
  const QByteArray magic = key.trimmed() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  return QCryptographicHash::hash(magic, QCryptographicHash::Sha1).toBase64();
}

bool isAllowedProxyHost(const QString &host) {
  static const QSet<QString> hosts = {
      QStringLiteral("www.pathofexile.com"),
      QStringLiteral("ru.pathofexile.com"),
      QStringLiteral("pathofexile.tw"),
      QStringLiteral("poe.game.daum.net"),
      QStringLiteral("jp.pathofexile.com"),
      QStringLiteral("de.pathofexile.com"),
      QStringLiteral("es.pathofexile.com"),
      QStringLiteral("br.pathofexile.com"),
      QStringLiteral("fr.pathofexile.com"),
      QStringLiteral("poe.ninja"),
      QStringLiteral("www.poeprices.info"),
      QStringLiteral("api.exiledexchange2.dev"),
  };
  return hosts.contains(host);
}

QByteArray headerValue(const QByteArray &headers, const QByteArray &name) {
  const QList<QByteArray> lines = headers.split('\n');
  const QByteArray prefix = name.toLower() + ':';
  for (const QByteArray &line : lines) {
    const QByteArray trimmed = line.trimmed();
    if (trimmed.toLower().startsWith(prefix)) {
      return trimmed.mid(prefix.size()).trimmed();
    }
  }
  return {};
}
} // namespace

NativeServer::NativeServer(QString staticRoot, QObject *parent)
    : QObject(parent), m_staticRoot(std::move(staticRoot)) {
  connect(&m_server, &QTcpServer::newConnection, this, &NativeServer::acceptConnection);
}

bool NativeServer::start() {
  return m_server.listen(QHostAddress::LocalHost, 0);
}

quint16 NativeServer::port() const {
  return m_server.serverPort();
}

QString NativeServer::url() const {
  return QStringLiteral("http://127.0.0.1:%1/index.html").arg(port());
}

QString NativeServer::configPath() const {
  const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation);
  return QDir(dir).filePath(QStringLiteral("config.json"));
}

QString NativeServer::loadConfig() const {
  QFile file(configPath());
  if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
    return {};
  }
  return QString::fromUtf8(file.readAll());
}

bool NativeServer::saveConfig(const QString &contents) {
  const QString path = configPath();
  QDir().mkpath(QFileInfo(path).absolutePath());

  QSaveFile file(path);
  if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
    return false;
  }

  file.write(contents.toUtf8());
  return file.commit();
}

void NativeServer::sendEvent(const QString &name, const QJsonObject &payload) {
  QJsonObject event;
  event.insert(QStringLiteral("name"), name);
  event.insert(QStringLiteral("payload"), payload);
  const QByteArray message = QJsonDocument(event).toJson(QJsonDocument::Compact);

  QByteArray frame;
  frame.append(char(0x81));
  if (message.size() < 126) {
    frame.append(char(message.size()));
  } else if (message.size() <= 0xffff) {
    frame.append(char(126));
    frame.append(char((message.size() >> 8) & 0xff));
    frame.append(char(message.size() & 0xff));
  } else {
    return;
  }
  frame.append(message);

  for (QTcpSocket *socket : std::as_const(m_webSockets)) {
    if (socket->state() == QAbstractSocket::ConnectedState) {
      socket->write(frame);
    }
  }
}

void NativeServer::acceptConnection() {
  while (QTcpSocket *socket = m_server.nextPendingConnection()) {
    connect(socket, &QTcpSocket::readyRead, this, [this, socket]() {
      readClient(socket);
    });
    connect(socket, &QTcpSocket::disconnected, this, [this, socket]() {
      m_webSockets.remove(socket);
      m_buffers.remove(socket);
      socket->deleteLater();
    });
  }
}

void NativeServer::readClient(QTcpSocket *socket) {
  QByteArray &buffer = m_buffers[socket];
  buffer.append(socket->readAll());

  if (m_webSockets.contains(socket)) {
    handleWebSocketFrame(socket, buffer);
    return;
  }

  const int headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd < 0) {
    return;
  }

  const QByteArray headers = buffer.left(headerEnd + 4);
  bool ok = false;
  const int contentLength = headerValue(headers, "content-length").toInt(&ok);
  const int requestSize = headerEnd + 4 + (ok ? contentLength : 0);
  if (buffer.size() < requestSize) {
    return;
  }

  const QByteArray request = buffer.left(requestSize);
  buffer.remove(0, requestSize);
  handleHttpRequest(socket, request);
}

void NativeServer::handleHttpRequest(QTcpSocket *socket, const QByteArray &request) {
  const QList<QByteArray> lines = request.split('\n');
  if (lines.isEmpty()) {
    sendHttp(socket, 404, "text/plain", "bad request");
    return;
  }

  const QList<QByteArray> parts = lines.first().trimmed().split(' ');
  if (parts.size() < 2) {
    sendHttp(socket, 404, "text/plain", "bad request");
    return;
  }

  const QString path = QUrl::fromPercentEncoding(parts[1]);
  if (request.contains("Upgrade: websocket") && path == QStringLiteral("/events")) {
    upgradeWebSocket(socket, request);
    return;
  }

  if (path == QStringLiteral("/config")) {
    const QString contents = loadConfig();
    QJsonObject updater;
    updater.insert(QStringLiteral("state"), QStringLiteral("initial"));

    QJsonObject state;
    state.insert(QStringLiteral("contents"),
                 contents.isEmpty() ? QJsonValue::Null : QJsonValue(contents));
    state.insert(QStringLiteral("version"), QStringLiteral("native"));
    state.insert(QStringLiteral("updater"), updater);
    sendHttp(socket, 200, "application/json", QJsonDocument(state).toJson(QJsonDocument::Compact));
    return;
  }

  if (path.startsWith(QStringLiteral("/proxy/"))) {
    sendProxyRequest(socket, request);
    return;
  }

  sendStaticFile(socket, path);
}

void NativeServer::sendProxyRequest(QTcpSocket *socket, const QByteArray &request) {
  const int headerEnd = request.indexOf("\r\n\r\n");
  if (headerEnd < 0) {
    sendHttp(socket, 404, "text/plain", "bad request");
    return;
  }

  const QByteArray headers = request.left(headerEnd + 4);
  const QByteArray body = request.mid(headerEnd + 4);
  const QList<QByteArray> lines = headers.split('\n');
  const QList<QByteArray> requestLine = lines.first().trimmed().split(' ');
  if (requestLine.size() < 2) {
    sendHttp(socket, 404, "text/plain", "bad request");
    return;
  }

  const QByteArray method = requestLine.first().trimmed();
  const QString path = QUrl::fromPercentEncoding(requestLine.at(1));
  const QString target = path.mid(QStringLiteral("/proxy/").size());
  const QUrl url(QStringLiteral("https://") + target);
  if (!url.isValid() || !isAllowedProxyHost(url.host())) {
    sendHttp(socket, 404, "text/plain", "proxy host not allowed");
    return;
  }

  QNetworkRequest proxyRequest(url);
  for (int i = 1; i < lines.size(); ++i) {
    const QByteArray line = lines.at(i).trimmed();
    const int colon = line.indexOf(':');
    if (colon <= 0) {
      continue;
    }

    const QByteArray name = line.left(colon).trimmed();
    const QByteArray lowerName = name.toLower();
    if (lowerName.startsWith("sec-") ||
        lowerName == "host" ||
        lowerName == "origin" ||
        lowerName == "content-length" ||
        lowerName == "connection" ||
        lowerName == "accept-encoding") {
      continue;
    }
    proxyRequest.setRawHeader(name, line.mid(colon + 1).trimmed());
  }
  proxyRequest.setRawHeader("User-Agent", "ExiledExchangeNative/0.1 Qt");

  QNetworkReply *reply = nullptr;
  if (method == "GET") {
    reply = m_network.get(proxyRequest);
  } else if (method == "POST") {
    reply = m_network.post(proxyRequest, body);
  } else {
    reply = m_network.sendCustomRequest(proxyRequest, method, body);
  }

  connect(reply, &QNetworkReply::finished, this, [this, socket, reply]() {
    if (socket->state() != QAbstractSocket::ConnectedState) {
      reply->deleteLater();
      return;
    }

    const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const QByteArray reason = reply->attribute(QNetworkRequest::HttpReasonPhraseAttribute).toByteArray();
    const QByteArray body = reply->readAll();
    socket->write("HTTP/1.1 " + QByteArray::number(status > 0 ? status : 502) + " " +
                  (reason.isEmpty() ? reasonPhrase(status > 0 ? status : 502) : reason) + "\r\n");
    for (const QByteArray &name : reply->rawHeaderList()) {
      const QByteArray lowerName = name.toLower();
      if (lowerName == "content-encoding" ||
          lowerName == "transfer-encoding" ||
          lowerName == "connection" ||
          lowerName == "content-length") {
        continue;
      }
      socket->write(name + ": " + reply->rawHeader(name) + "\r\n");
    }
    socket->write("Content-Length: " + QByteArray::number(body.size()) + "\r\n");
    socket->write("Connection: close\r\n\r\n");
    socket->write(body);
    socket->disconnectFromHost();
    reply->deleteLater();
  });
}

void NativeServer::handleWebSocketFrame(QTcpSocket *socket, QByteArray &data) {
  while (data.size() >= 2) {
    const quint8 first = quint8(data[0]);
    const quint8 second = quint8(data[1]);
    const quint8 opcode = first & 0x0f;
    const bool masked = (second & 0x80) != 0;

    quint64 payloadLength = second & 0x7f;
    int headerSize = 2;
    if (payloadLength == 126) {
      if (data.size() < 4) return;
      payloadLength = (quint8(data[2]) << 8) | quint8(data[3]);
      headerSize = 4;
    } else if (payloadLength == 127) {
      if (data.size() < 10) return;
      payloadLength = 0;
      for (int i = 2; i < 10; ++i) {
        payloadLength = (payloadLength << 8) | quint8(data[i]);
      }
      headerSize = 10;
    }

    if (masked) {
      headerSize += 4;
    }
    if (payloadLength > quint64(std::numeric_limits<int>::max())) {
      socket->disconnectFromHost();
      data.clear();
      return;
    }
    if (data.size() < headerSize + int(payloadLength)) {
      return;
    }

    QByteArray payload = data.mid(headerSize, int(payloadLength));
    if (masked) {
      const int maskOffset = headerSize - 4;
      const QByteArray mask = data.mid(maskOffset, 4);
      for (int i = 0; i < payload.size(); ++i) {
        payload[i] = char(quint8(payload[i]) ^ quint8(mask[i % 4]));
      }
    }
    data.remove(0, headerSize + int(payloadLength));

    if (opcode == 0x8) {
      socket->disconnectFromHost();
      return;
    }
    if (opcode != 0x1) {
      continue;
    }

    const QJsonDocument document = QJsonDocument::fromJson(payload);
    if (!document.isObject()) {
      continue;
    }

    const QJsonObject event = document.object();
    const QString name = event.value(QStringLiteral("name")).toString();
    if (name.isEmpty()) {
      continue;
    }
    emit eventReceived(name, event.value(QStringLiteral("payload")).toObject());
  }
}

void NativeServer::sendHttp(QTcpSocket *socket, int status, const QByteArray &contentType, const QByteArray &body) {
  socket->write("HTTP/1.1 " + QByteArray::number(status) + " " + reasonPhrase(status) + "\r\n");
  socket->write("Content-Type: " + contentType + "\r\n");
  socket->write("Content-Length: " + QByteArray::number(body.size()) + "\r\n");
  socket->write("Connection: close\r\n\r\n");
  socket->write(body);
  socket->disconnectFromHost();
}

void NativeServer::sendStaticFile(QTcpSocket *socket, const QString &urlPath) {
  QString cleanPath = QDir::cleanPath(urlPath);
  if (cleanPath == QStringLiteral("/") || cleanPath == QStringLiteral(".")) {
    cleanPath = QStringLiteral("/index.html");
  }
  if (cleanPath.contains(QStringLiteral(".."))) {
    sendHttp(socket, 404, "text/plain", "not found");
    return;
  }

  const QString filePath = QDir(m_staticRoot).filePath(cleanPath.mid(1));
  QFile file(filePath);
  if (!file.open(QIODevice::ReadOnly)) {
    sendHttp(socket, 404, "text/plain", "not found");
    return;
  }

  sendHttp(socket, 200, mimeType(filePath), file.readAll());
}

void NativeServer::upgradeWebSocket(QTcpSocket *socket, const QByteArray &request) {
  const QRegularExpression re(QStringLiteral("Sec-WebSocket-Key:\\s*([^\\r\\n]+)"));
  const QRegularExpressionMatch match = re.match(QString::fromLatin1(request));
  if (!match.hasMatch()) {
    sendHttp(socket, 404, "text/plain", "missing websocket key");
    return;
  }

  const QByteArray accept = webSocketAccept(match.captured(1).toLatin1());
  socket->write("HTTP/1.1 101 Switching Protocols\r\n");
  socket->write("Upgrade: websocket\r\n");
  socket->write("Connection: Upgrade\r\n");
  socket->write("Sec-WebSocket-Accept: " + accept + "\r\n\r\n");
  m_webSockets.insert(socket);
  emit clientConnected();
}

QByteArray NativeServer::mimeType(const QString &path) const {
  if (path.endsWith(QStringLiteral(".html"))) return "text/html; charset=utf-8";
  if (path.endsWith(QStringLiteral(".js"))) return "application/javascript";
  if (path.endsWith(QStringLiteral(".css"))) return "text/css";
  if (path.endsWith(QStringLiteral(".json"))) return "application/json";
  if (path.endsWith(QStringLiteral(".png"))) return "image/png";
  if (path.endsWith(QStringLiteral(".jpg")) || path.endsWith(QStringLiteral(".jpeg"))) return "image/jpeg";
  if (path.endsWith(QStringLiteral(".webp"))) return "image/webp";
  if (path.endsWith(QStringLiteral(".ttf"))) return "font/ttf";
  if (path.endsWith(QStringLiteral(".bin"))) return "application/octet-stream";
  if (path.endsWith(QStringLiteral(".ndjson"))) return "application/x-ndjson";
  return "application/octet-stream";
}
