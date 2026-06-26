#include "NativeHost.h"

#include <KGlobalAccel>

#include <QApplication>
#include <QCoreApplication>
#include <QCursor>
#include <QDir>
#include <QJsonObject>
#include <QKeySequence>
#include <QProcess>
#include <QStandardPaths>
#include <QTextStream>
#include <QTimer>
#include <QUrl>

namespace {
QString ydotoolPath() {
  return QStandardPaths::findExecutable(QStringLiteral("ydotool"));
}
} // namespace

NativeHost::NativeHost(QObject *parent)
    : QObject(parent),
      m_server(QDir(QCoreApplication::applicationDirPath()).filePath(QStringLiteral("../renderer/dist")), this),
      m_clipboard(QApplication::clipboard()),
      m_priceCheckAction(QStringLiteral("Price check item"), this),
      m_toggleOverlayAction(QStringLiteral("Toggle Exiled Exchange overlay"), this),
      m_hideoutAction(QStringLiteral("Go to hideout"), this),
      m_exitAction(QStringLiteral("Exit to character selection"), this) {
  if (m_server.start()) {
    log(QStringLiteral("native Vue server listening at %1").arg(m_server.url()));
    m_overlay.loadVue(QUrl(m_server.url()));
  } else {
    log(QStringLiteral("failed to start native Vue server"));
  }

  m_priceCheckAction.setObjectName(QStringLiteral("price-check"));
  m_toggleOverlayAction.setObjectName(QStringLiteral("toggle-overlay"));
  m_hideoutAction.setObjectName(QStringLiteral("hideout"));
  m_exitAction.setObjectName(QStringLiteral("exit"));

  connect(&m_priceCheckAction, &QAction::triggered, this, &NativeHost::priceCheck);
  connect(&m_toggleOverlayAction, &QAction::triggered, this, &NativeHost::toggleOverlay);
  connect(&m_hideoutAction, &QAction::triggered, this, &NativeHost::hideout);
  connect(&m_exitAction, &QAction::triggered, this, &NativeHost::exitToCharacter);
  connect(&m_overlay, &NativeOverlay::pageLoaded, this, [this]() {
    QTimer::singleShot(250, this, &NativeHost::publishOverlayAttached);
  });
  connect(&m_overlay, &NativeOverlay::focusGameRequested, this, &NativeHost::handleOverlayFocusGame);
  connect(&m_overlay, &NativeOverlay::overlayModeChanged, this, [this](bool interactive) {
    publishFocusChange(!interactive, interactive);
  });
  connect(&m_overlay, &NativeOverlay::passiveHidden, this, &NativeHost::publishHideExclusiveWidget);
  connect(&m_server, &NativeServer::clientConnected, this, [this]() {
    QTimer::singleShot(250, this, &NativeHost::publishOverlayAttached);
  });
  connect(&m_server, &NativeServer::eventReceived, this, &NativeHost::handleServerEvent);
  connect(KGlobalAccel::self(),
          &KGlobalAccel::globalShortcutActiveChanged,
          this,
          [this](QAction *action, bool active) {
            if (!active || action == nullptr) {
              return;
            }
            log(QStringLiteral("KGlobalAccel activated %1").arg(action->objectName()));
          });

  registerShortcut(&m_priceCheckAction, QKeySequence(QStringLiteral("Ctrl+D")));
  registerShortcut(&m_toggleOverlayAction, QKeySequence(QStringLiteral("Ctrl+Alt+P")));
  registerShortcut(&m_hideoutAction, QKeySequence(QStringLiteral("F5")));
  registerShortcut(&m_exitAction, QKeySequence(QStringLiteral("F9")));
}

void NativeHost::priceCheck() {
  if (m_priceCheckInProgress) {
    log(QStringLiteral("priceCheck ignored: already in progress"));
    return;
  }

  log(QStringLiteral("priceCheck triggered"));
  m_priceCheckInProgress = true;
  const QPoint cursorPosition = QCursor::pos();

  QTimer::singleShot(120, this, [this]() {
    pressCopy();
  });

  QTimer::singleShot(420, this, [this]() {
    pressCopy();
  });

  QTimer::singleShot(760, this, [this, cursorPosition]() {
    const QString text = readClipboardText();
    log(QStringLiteral("clipboard chars after copy: %1").arg(text.size()));
    QString preview = text.left(180);
    preview.replace(QLatin1Char('\r'), QLatin1Char(' '));
    preview.replace(QLatin1Char('\n'), QLatin1String(" | "));
    log(QStringLiteral("clipboard preview: %1").arg(preview));

    if (!looksLikeItemText(text)) {
      log(QStringLiteral("priceCheck aborted: clipboard did not contain copied item text"));
      m_priceCheckInProgress = false;
      return;
    }

    QJsonObject position;
    position.insert(QStringLiteral("x"), cursorPosition.x());
    position.insert(QStringLiteral("y"), cursorPosition.y());

    QJsonObject payload;
    payload.insert(QStringLiteral("target"), QStringLiteral("price-check"));
    payload.insert(QStringLiteral("clipboard"), text);
    payload.insert(QStringLiteral("position"), position);
    payload.insert(QStringLiteral("focusOverlay"), false);
    m_server.sendEvent(QStringLiteral("MAIN->CLIENT::item-text"), payload);
    m_overlay.showPassive(cursorPosition);
    m_priceCheckInProgress = false;
  });
}

void NativeHost::toggleOverlay() {
  log(QStringLiteral("toggleOverlay triggered"));
  m_isOverlayKeyUsed = true;
  m_overlay.toggleInteractive();
}

void NativeHost::hideout() {
  log(QStringLiteral("hideout triggered"));
  typeChatCommand(QStringLiteral("/hideout"));
}

void NativeHost::exitToCharacter() {
  log(QStringLiteral("exit triggered"));
  typeChatCommand(QStringLiteral("/exit"));
}

void NativeHost::handleOverlayFocusGame() {
  log(QStringLiteral("overlay requested game focus"));
  m_overlay.hideOverlay();
  publishFocusChange(true, false);
}

void NativeHost::handleServerEvent(const QString &name, const QJsonObject &payload) {
  if (name == QStringLiteral("OVERLAY->MAIN::focus-game")) {
    handleOverlayFocusGame();
    return;
  }

  if (name == QStringLiteral("OVERLAY->MAIN::track-area")) {
    log(QStringLiteral("renderer requested overlay track area"));
    m_overlay.acceptInput();
    return;
  }

  if (name == QStringLiteral("CLIENT->MAIN::used-recently")) {
    const bool isOverlay = payload.value(QStringLiteral("isOverlay")).toBool();
    log(QStringLiteral("renderer used recently isOverlay=%1").arg(isOverlay ? QStringLiteral("true") : QStringLiteral("false")));
    return;
  }

  if (name == QStringLiteral("CLIENT->MAIN::update-host-config")) {
    log(QStringLiteral("renderer sent host config"));
    return;
  }

  if (name == QStringLiteral("CLIENT->MAIN::save-config")) {
    const QString contents = payload.value(QStringLiteral("contents")).toString();
    if (contents.isEmpty()) {
      log(QStringLiteral("renderer requested config save with empty contents"));
      return;
    }

    if (m_server.saveConfig(contents)) {
      log(QStringLiteral("saved config to %1").arg(m_server.configPath()));
    } else {
      log(QStringLiteral("failed to save config to %1").arg(m_server.configPath()));
    }
    return;
  }
}

void NativeHost::publishOverlayAttached() {
  m_server.sendEvent(QStringLiteral("MAIN->OVERLAY::overlay-attached"), {});
  publishFocusChange(!m_overlay.isInteractive(), m_overlay.isInteractive());
}

void NativeHost::publishFocusChange(bool gameFocused, bool overlayFocused) {
  QJsonObject payload;
  payload.insert(QStringLiteral("game"), gameFocused);
  payload.insert(QStringLiteral("overlay"), overlayFocused);
  payload.insert(QStringLiteral("usingHotkey"), m_isOverlayKeyUsed);
  m_server.sendEvent(QStringLiteral("MAIN->OVERLAY::focus-change"), payload);
  m_isOverlayKeyUsed = false;
}

void NativeHost::publishHideExclusiveWidget() {
  m_server.sendEvent(QStringLiteral("MAIN->OVERLAY::hide-exclusive-widget"), {});
}

void NativeHost::registerShortcut(QAction *action, const QKeySequence &sequence) {
  bool available = KGlobalAccel::isGlobalShortcutAvailable(sequence);
  if (!available) {
    log(QStringLiteral("shortcut %1 is already owned; stealing it for %2")
            .arg(sequence.toString(QKeySequence::PortableText),
                 action->objectName()));
    KGlobalAccel::stealShortcutSystemwide(sequence);
    available = KGlobalAccel::isGlobalShortcutAvailable(sequence);
  }

  const bool defaultOk = KGlobalAccel::self()->setDefaultShortcut(
      action,
      QList<QKeySequence>{sequence},
      KGlobalAccel::NoAutoloading);
  const bool shortcutOk = KGlobalAccel::self()->setShortcut(
      action,
      QList<QKeySequence>{sequence},
      KGlobalAccel::NoAutoloading);
  const QList<QKeySequence> active = KGlobalAccel::self()->shortcut(action);

  log(QStringLiteral("shortcut action=%1 wanted=%2 available=%3 defaultOk=%4 shortcutOk=%5 active=%6")
          .arg(action->objectName(),
               sequence.toString(QKeySequence::PortableText),
               available ? QStringLiteral("true") : QStringLiteral("false"),
               defaultOk ? QStringLiteral("true") : QStringLiteral("false"),
               shortcutOk ? QStringLiteral("true") : QStringLiteral("false"),
               active.isEmpty()
                   ? QStringLiteral("<none>")
                   : active.first().toString(QKeySequence::PortableText)));
}

void NativeHost::log(const QString &message) {
  const QString line =
      QStringLiteral("[exiled-exchange-native] %1").arg(message);
  QTextStream(stderr) << line << Qt::endl;
}

void NativeHost::runYdotool(const QStringList &arguments) {
  const QString executable = ydotoolPath();
  if (executable.isEmpty()) {
    log(QStringLiteral("ydotool is not installed or not in PATH"));
    return;
  }

  QProcess process;
  process.start(executable, arguments);
  if (!process.waitForFinished(2000)) {
    process.kill();
    log(QStringLiteral("ydotool timed out: %1").arg(arguments.join(QLatin1Char(' '))));
    return;
  }

  const QString stderrText = QString::fromUtf8(process.readAllStandardError()).trimmed();
  log(QStringLiteral("ydotool exit=%1 args=%2%3")
          .arg(process.exitCode())
          .arg(arguments.join(QLatin1Char(' ')),
               stderrText.isEmpty() ? QString() : QStringLiteral(" stderr=%1").arg(stderrText)));
}

void NativeHost::pressCopy() {
  runYdotool({
      QStringLiteral("key"),
      QStringLiteral("--key-delay"),
      QStringLiteral("18"),
      QStringLiteral("32:0"),
      QStringLiteral("29:0"),
      QStringLiteral("29:1"),
      QStringLiteral("46:1"),
      QStringLiteral("46:0"),
      QStringLiteral("29:0"),
  });
}

bool NativeHost::looksLikeItemText(const QString &text) const {
  if (!text.contains(QStringLiteral("--------"))) {
    return false;
  }
  return text.startsWith(QStringLiteral("Item Class: ")) ||
         text.startsWith(QStringLiteral("Rarity: ")) ||
         text.startsWith(QStringLiteral("Requirements:"));
}

QString NativeHost::readClipboardText() {
  const QString wlPaste = QStandardPaths::findExecutable(QStringLiteral("wl-paste"));
  if (!wlPaste.isEmpty()) {
    QProcess process;
    process.start(wlPaste, {QStringLiteral("--no-newline")});
    if (process.waitForFinished(1200) && process.exitCode() == 0) {
      const QString text = QString::fromUtf8(process.readAllStandardOutput());
      log(QStringLiteral("wl-paste chars=%1").arg(text.size()));
      if (!text.isEmpty()) {
        return text;
      }
    } else {
      log(QStringLiteral("wl-paste failed exit=%1 stderr=%2")
              .arg(process.exitCode())
              .arg(QString::fromUtf8(process.readAllStandardError()).trimmed()));
    }
  }

  const QString xclip = QStandardPaths::findExecutable(QStringLiteral("xclip"));
  if (!xclip.isEmpty()) {
    for (const QString &selection : {QStringLiteral("clipboard"), QStringLiteral("primary")}) {
      QProcess process;
      process.start(xclip, {
                               QStringLiteral("-selection"),
                               selection,
                               QStringLiteral("-out"),
                           });
      if (process.waitForFinished(1200) && process.exitCode() == 0) {
        const QString text = QString::fromUtf8(process.readAllStandardOutput());
        log(QStringLiteral("xclip %1 chars=%2").arg(selection).arg(text.size()));
        if (!text.isEmpty()) {
          return text;
        }
      } else {
        log(QStringLiteral("xclip %1 failed exit=%2 stderr=%3")
                .arg(selection)
                .arg(process.exitCode())
                .arg(QString::fromUtf8(process.readAllStandardError()).trimmed()));
      }
    }
  }

  const QString xsel = QStandardPaths::findExecutable(QStringLiteral("xsel"));
  if (!xsel.isEmpty()) {
    QProcess process;
    process.start(xsel, {QStringLiteral("--clipboard"), QStringLiteral("--output")});
    if (process.waitForFinished(1200) && process.exitCode() == 0) {
      const QString text = QString::fromUtf8(process.readAllStandardOutput());
      log(QStringLiteral("xsel clipboard chars=%1").arg(text.size()));
      if (!text.isEmpty()) {
        return text;
      }
    } else {
      log(QStringLiteral("xsel clipboard failed exit=%1 stderr=%2")
              .arg(process.exitCode())
              .arg(QString::fromUtf8(process.readAllStandardError()).trimmed()));
    }
  }

  const QString qtText = m_clipboard->text(QClipboard::Clipboard);
  log(QStringLiteral("Qt clipboard chars=%1").arg(qtText.size()));
  return qtText;
}

void NativeHost::typeChatCommand(const QString &text) {
  QTimer::singleShot(120, this, [this]() {
    runYdotool({
        QStringLiteral("key"),
        QStringLiteral("--key-delay"),
        QStringLiteral("12"),
        QStringLiteral("28:1"),
        QStringLiteral("28:0"),
    });
  });
  QTimer::singleShot(320, this, [this, text]() {
    runYdotool({
        QStringLiteral("type"),
        QStringLiteral("--key-delay"),
        QStringLiteral("12"),
        text,
    });
  });
  QTimer::singleShot(520, this, [this]() {
    runYdotool({
        QStringLiteral("key"),
        QStringLiteral("--key-delay"),
        QStringLiteral("12"),
        QStringLiteral("28:1"),
        QStringLiteral("28:0"),
    });
  });
}
