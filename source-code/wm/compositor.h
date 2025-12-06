// compositor.h

/****************************************************************************
**
** Copyright (C) 2017 The Qt Company Ltd.
** Contact: https://www.qt.io/licensing/
**
** This file is part of the examples of the Qt Wayland module
**
** $QT_BEGIN_LICENSE:BSD$
** Commercial License Usage
** Licensees holding valid commercial Qt licenses may use this file in
** accordance with the commercial license agreement provided with the
** Software or, alternatively, in accordance with the terms contained in
** a written agreement between you and The Qt Company. For licensing terms
** and conditions see https://www.qt.io/terms-conditions. For further
** information use the contact form at https://www.qt.io/contact-us.
**
** BSD License Usage
** Alternatively, you may use this file under the terms of the BSD license
** as follows:
**
** "Redistribution and use in source and binary forms, with or without
** modification, are permitted provided that the following conditions are
** met:
**   * Redistributions of source code must retain the above copyright
**     notice, this list of conditions and the following disclaimer.
**   * Redistributions in binary form must reproduce the above copyright
**     notice, this list of conditions and the following disclaimer in
**     the documentation and/or other materials provided with the
**     distribution.
**   * Neither the name of The Qt Company Ltd nor the names of its
**     contributors may be used to endorse or promote products derived
**     from this software without specific prior written permission.
**
**
** THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
** "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
** LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
** A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
** OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
** SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
** LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
** DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
** THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
** (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
** OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE."
**
** $QT_END_LICENSE$
**
****************************************************************************/

#ifndef COMPOSITOR_H
#define COMPOSITOR_H

#include <QtWaylandCompositor/QWaylandCompositor>
#include <QtWaylandCompositor/QWaylandSurface>
#include <QtWaylandCompositor/QWaylandView>
#include <QtWaylandCompositor/QWaylandXdgShell>
#include <QtWaylandCompositor/QWaylandWlShell>
#include <QtCore/QPointer>

QT_BEGIN_NAMESPACE

class Window;
class QOpenGLTexture;

class View : public QWaylandView
{
    Q_OBJECT
public:
    View();
    QOpenGLTexture *getTexture();
    QRect globalGeometry() const { return QRect(globalPosition(), surface()->destinationSize()); }
    void setGlobalPosition(const QPoint &pos) { m_pos = pos; }
    QPoint globalPosition() const { return m_pos; }
    QPoint mapToLocal(const QPoint &globalPos) const;
    QSize size() const { return surface() ? surface()->destinationSize() : QSize(); }
    void initPosition(const QSize &screenSize, const QSize &surfaceSize);

    QWaylandXdgToplevel *toplevel() const { return m_toplevel; }
    void setToplevel(QWaylandXdgToplevel *toplevel) { m_toplevel = toplevel; }

    QWaylandWlShellSurface *shellSurface() const { return m_shellSurface; }
    void setShellSurface(QWaylandWlShellSurface *shellSurface) { m_shellSurface = shellSurface; }

private:
    QOpenGLTexture *m_texture = nullptr;
    QPoint m_pos;
    QWaylandXdgToplevel *m_toplevel = nullptr;
    QWaylandWlShellSurface *m_shellSurface = nullptr;
};

class Compositor : public QWaylandCompositor
{
    Q_OBJECT
public:
    Compositor(Window *window);
    ~Compositor() override;
    void create() override;

    QList<View *> views() const { return m_views; }
    View *viewAt(const QPoint &position);
    void raise(View *view);

    void handleMousePress(const QPoint &position, Qt::MouseButton button);
    void handleMouseRelease(const QPoint &position, Qt::MouseButton button, Qt::MouseButtons buttons);
    void handleMouseMove(const QPoint &position);
    void handleMouseWheel(const QPoint &angleDelta);

    void handleKeyPress(quint32 nativeScanCode);
    void handleKeyRelease(quint32 nativeScanCode);

    void startRender();
    void endRender();

    void toggleTiling();

private slots:
    void onToplevelCreated(QWaylandXdgToplevel *toplevel, QWaylandSurface *surface);
    void onShellSurfaceCreated(QWaylandWlShellSurface *shellSurface);
    void viewSurfaceDestroyed();
    void triggerRender();

private:
    void arrange();
    Window *m_window = nullptr;
    QWaylandXdgShell *m_xdgShell = nullptr;
    QWaylandWlShell *m_wlShell = nullptr;
    QList<View *> m_views;
    QPointer<View> m_mouseView;
    QPointer<View> m_grabbedView;
    QPoint m_grabPos;
    bool m_tiling = false;
};

QT_END_NAMESPACE

#endif // COMPOSITOR_H
