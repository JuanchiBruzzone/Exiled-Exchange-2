QT += core gui widgets dbus network webenginewidgets
CONFIG += c++20 console
CONFIG -= app_bundle

TARGET = exiled-exchange-native
TEMPLATE = app

INCLUDEPATH += /usr/include/KF6/KGlobalAccel
INCLUDEPATH += /usr/include/KF6/KWindowSystem
INCLUDEPATH += /usr/include/KF6/KCoreAddons

LIBS += -lKF6GlobalAccel
LIBS += -lKF6WindowSystem
LIBS += -lKF6CoreAddons
LIBS += -lLayerShellQtInterface

SOURCES += \
    src/main.cpp \
    src/NativeHost.cpp \
    src/NativeOverlay.cpp \
    src/NativeServer.cpp

HEADERS += \
    src/NativeHost.h \
    src/NativeOverlay.h \
    src/NativeServer.h
