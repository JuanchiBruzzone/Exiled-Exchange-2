#pragma once

#include <QProcess>
#include <QTimer>
#include <QWidget>

class QWebEngineView;
class QUrl;
class QEvent;
class QKeyEvent;

class NativeOverlay final : public QWidget {
  Q_OBJECT

public:
  explicit NativeOverlay(QWidget *parent = nullptr);

  void loadVue(const QUrl &url);
  void showPassive(const QPoint &cursorPosition);
  void acceptInput();
  void toggleInteractive();
  void hideOverlay();
  bool isInteractive() const;

signals:
  void pageLoaded();
  void focusGameRequested();
  void overlayModeChanged(bool interactive);
  void passiveHidden();

protected:
  void keyPressEvent(QKeyEvent *event) override;
  void changeEvent(QEvent *event) override;

private:
  void applyPassiveFlags();
  void applyInteractiveFlags();
  void configureLayerShell(QScreen *screen, bool interactive);
  void positionNearCursor(const QPoint &cursorPosition);

  QWebEngineView *m_view = nullptr;
  QTimer m_hideTimer;
  bool m_interactive = false;
};
