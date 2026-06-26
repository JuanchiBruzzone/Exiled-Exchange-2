#pragma once

#include "NativeOverlay.h"
#include "NativeServer.h"

#include <QAction>
#include <QClipboard>
#include <QObject>
#include <QPoint>
#include <QTextStream>

class NativeHost final : public QObject {
  Q_OBJECT

public:
  explicit NativeHost(QObject *parent = nullptr);

private slots:
  void priceCheck();
  void toggleOverlay();
  void hideout();
  void exitToCharacter();

private:
  void registerShortcut(QAction *action, const QKeySequence &sequence);
  void log(const QString &message);
  void runYdotool(const QStringList &arguments);
  void pressCopy();
  bool looksLikeItemText(const QString &text) const;
  QString readClipboardText();
  void typeChatCommand(const QString &text);
  void handleOverlayFocusGame();
  void handleServerEvent(const QString &name, const QJsonObject &payload);
  void publishOverlayAttached();
  void publishFocusChange(bool gameFocused, bool overlayFocused);
  void publishHideExclusiveWidget();

  NativeOverlay m_overlay;
  NativeServer m_server;
  QClipboard *m_clipboard = nullptr;
  QAction m_priceCheckAction;
  QAction m_toggleOverlayAction;
  QAction m_hideoutAction;
  QAction m_exitAction;
  bool m_isOverlayKeyUsed = false;
  bool m_priceCheckInProgress = false;
};
