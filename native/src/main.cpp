#include "NativeHost.h"

#include <KAboutData>
#include <LayerShellQt/Shell>

#include <QApplication>
#include <QCommandLineParser>
#include <QCoreApplication>
#include <QGuiApplication>

int main(int argc, char **argv) {
  QCoreApplication::setApplicationName(QStringLiteral("exiled-exchange-native"));
  QCoreApplication::setOrganizationDomain(QStringLiteral("local.exiled-exchange"));
  QCoreApplication::setOrganizationName(QStringLiteral("Exiled Exchange"));
  QCoreApplication::setApplicationVersion(QStringLiteral("0.1.0"));
  QGuiApplication::setDesktopFileName(QStringLiteral("exiled-exchange-native"));
  qputenv("QT_WAYLAND_SHELL_INTEGRATION", QByteArrayLiteral("layer-shell"));
  LayerShellQt::Shell::useLayerShell();

  QApplication app(argc, argv);

  KAboutData aboutData(
      QStringLiteral("exiled-exchange-native"),
      QStringLiteral("Exiled Exchange Native"),
      QStringLiteral("0.1.0"));
  aboutData.setDesktopFileName(QStringLiteral("exiled-exchange-native"));
  KAboutData::setApplicationData(aboutData);

  QCommandLineParser parser;
  parser.setApplicationDescription(QStringLiteral("Native KDE Plasma Wayland host for Exiled Exchange 2"));
  parser.addHelpOption();
  parser.addVersionOption();
  parser.process(app);

  NativeHost host;
  return app.exec();
}
