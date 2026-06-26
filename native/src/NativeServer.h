#pragma once

#include <QByteArray>
#include <QHostAddress>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QObject>
#include <QSet>
#include <QTcpServer>
#include <QTcpSocket>

class NativeServer final : public QObject {
  Q_OBJECT

public:
  explicit NativeServer(QString staticRoot, QObject *parent = nullptr);

  bool start();
  quint16 port() const;
  QString url() const;
  void sendEvent(const QString &name, const QJsonObject &payload);
  QString configPath() const;
  QString loadConfig() const;
  bool saveConfig(const QString &contents);

signals:
  void clientConnected();
  void eventReceived(const QString &name, const QJsonObject &payload);

private slots:
  void acceptConnection();

private:
  void readClient(QTcpSocket *socket);
  void handleHttpRequest(QTcpSocket *socket, const QByteArray &request);
  void handleWebSocketFrame(QTcpSocket *socket, QByteArray &data);
  void sendProxyRequest(QTcpSocket *socket, const QByteArray &request);
  void sendHttp(QTcpSocket *socket, int status, const QByteArray &contentType, const QByteArray &body);
  void sendStaticFile(QTcpSocket *socket, const QString &urlPath);
  void upgradeWebSocket(QTcpSocket *socket, const QByteArray &request);
  QByteArray mimeType(const QString &path) const;

  QString m_staticRoot;
  QTcpServer m_server;
  QNetworkAccessManager m_network;
  QSet<QTcpSocket *> m_webSockets;
  QHash<QTcpSocket *, QByteArray> m_buffers;
};
