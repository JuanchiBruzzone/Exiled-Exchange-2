#include "NativeOverlay.h"

#include <LayerShellQt/Window>

#include <QApplication>
#include <QCursor>
#include <QDebug>
#include <QEvent>
#include <QGuiApplication>
#include <QKeyEvent>
#include <QScreen>
#include <QVBoxLayout>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QWebEngineView>

#include <algorithm>

NativeOverlay::NativeOverlay(QWidget *parent) : QWidget(parent) {
  setWindowTitle(QStringLiteral("Exiled Exchange Native Overlay"));
  setAttribute(Qt::WA_TranslucentBackground, true);
  setAttribute(Qt::WA_ShowWithoutActivating, true);
  setAttribute(Qt::WA_DeleteOnClose, false);

  m_view = new QWebEngineView(this);
  m_view->setAttribute(Qt::WA_TranslucentBackground, true);
  m_view->page()->setBackgroundColor(Qt::transparent);
  m_view->page()->profile()->setHttpUserAgent(
      m_view->page()->profile()->httpUserAgent() + QStringLiteral(" Electron/Native"));
  m_view->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
  m_view->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, true);
  connect(m_view, &QWebEngineView::loadFinished, this, [this](bool ok) {
    if (ok) {
      emit pageLoaded();
    }
  });

  resize(1, 1);

  m_hideTimer.setSingleShot(true);
  connect(&m_hideTimer, &QTimer::timeout, this, &NativeOverlay::hideOverlay);

  applyPassiveFlags();
}

void NativeOverlay::loadVue(const QUrl &url) {
  m_view->load(url);
}

void NativeOverlay::showPassive(const QPoint &cursorPosition) {
  m_interactive = false;
  applyPassiveFlags();
  positionNearCursor(cursorPosition);

  configureLayerShell(QGuiApplication::screenAt(cursorPosition), false);
  show();
  m_hideTimer.start(4500);
  emit overlayModeChanged(true);
}

void NativeOverlay::acceptInput() {
  if (!isVisible()) {
    return;
  }

  m_hideTimer.stop();
  setWindowFlag(Qt::WindowTransparentForInput, false);
  setAttribute(Qt::WA_ShowWithoutActivating, true);
  configureLayerShell(QGuiApplication::screenAt(QCursor::pos()), false);
  show();
  emit overlayModeChanged(true);
}

void NativeOverlay::toggleInteractive() {
  m_hideTimer.stop();

  if (isVisible() && m_interactive) {
    hideOverlay();
    return;
  }

  m_interactive = true;
  applyInteractiveFlags();
  positionNearCursor(QCursor::pos());
  configureLayerShell(QGuiApplication::screenAt(QCursor::pos()), true);
  show();
  raise();
  emit overlayModeChanged(true);
}

void NativeOverlay::hideOverlay() {
  const bool wasVisible = isVisible();
  const bool wasInteractive = m_interactive;
  m_hideTimer.stop();
  hide();
  m_interactive = false;
  applyPassiveFlags();
  if (wasVisible) {
    emit overlayModeChanged(false);
  }
  if (wasVisible && !wasInteractive) {
    emit passiveHidden();
  }
}

bool NativeOverlay::isInteractive() const {
  return m_interactive;
}

void NativeOverlay::applyPassiveFlags() {
  setWindowFlag(Qt::FramelessWindowHint, true);
  setWindowFlag(Qt::Window, true);
  setWindowFlag(Qt::Tool, false);
  setWindowFlag(Qt::WindowStaysOnTopHint, true);
  setWindowFlag(Qt::WindowDoesNotAcceptFocus, true);
  setWindowFlag(Qt::WindowTransparentForInput, true);
  setAttribute(Qt::WA_ShowWithoutActivating, true);
}

void NativeOverlay::applyInteractiveFlags() {
  setWindowFlag(Qt::FramelessWindowHint, true);
  setWindowFlag(Qt::Window, true);
  setWindowFlag(Qt::Tool, false);
  setWindowFlag(Qt::WindowStaysOnTopHint, true);
  setWindowFlag(Qt::WindowDoesNotAcceptFocus, true);
  setWindowFlag(Qt::WindowTransparentForInput, false);
  setAttribute(Qt::WA_ShowWithoutActivating, true);
}

void NativeOverlay::keyPressEvent(QKeyEvent *event) {
  const bool ctrl = (event->modifiers() & Qt::ControlModifier) != 0;
  if (event->key() == Qt::Key_Escape || (ctrl && event->key() == Qt::Key_W)) {
    event->accept();
    emit focusGameRequested();
    return;
  }

  QWidget::keyPressEvent(event);
}

void NativeOverlay::changeEvent(QEvent *event) {
  QWidget::changeEvent(event);
  if (event->type() == QEvent::ActivationChange && m_interactive && !isActiveWindow()) {
    emit focusGameRequested();
  }
}

void NativeOverlay::configureLayerShell(QScreen *screen, bool interactive) {
  if (screen == nullptr) {
    screen = QGuiApplication::primaryScreen();
  }

  winId();
  LayerShellQt::Window *layerWindow = LayerShellQt::Window::get(windowHandle());
  if (layerWindow == nullptr) {
    qWarning() << "[exiled-exchange-native] LayerShellQt window unavailable";
    return;
  }

  layerWindow->setScope(QStringLiteral("exiled-exchange-native-overlay"));
  layerWindow->setLayer(LayerShellQt::Window::LayerOverlay);
  layerWindow->setAnchors(
      LayerShellQt::Window::Anchors(LayerShellQt::Window::AnchorTop) |
      LayerShellQt::Window::AnchorBottom |
      LayerShellQt::Window::AnchorLeft |
      LayerShellQt::Window::AnchorRight);
  layerWindow->setExclusiveZone(-1);
  layerWindow->setMargins({});
  layerWindow->setScreen(screen);
  layerWindow->setDesiredSize(screen != nullptr ? screen->geometry().size() : size());
  layerWindow->setActivateOnShow(false);
  layerWindow->setKeyboardInteractivity(LayerShellQt::Window::KeyboardInteractivityNone);
  qWarning() << "[exiled-exchange-native] LayerShellQt configured interactive=" << interactive
             << "screen=" << (screen != nullptr ? screen->name() : QStringLiteral("<none>"));
}

void NativeOverlay::positionNearCursor(const QPoint &cursorPosition) {
  const QScreen *screen = QGuiApplication::screenAt(cursorPosition);
  if (screen == nullptr) {
    screen = QGuiApplication::primaryScreen();
  }

  const QRect screenGeometry =
      screen != nullptr ? screen->geometry() : QRect(0, 0, 1280, 720);
  setGeometry(screenGeometry);
  m_view->setGeometry(rect());
}
