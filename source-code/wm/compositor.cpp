/****************************************************************************
 * *
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
 ** * Redistributions of source code must retain the above copyright
 ** notice, this list of conditions and the following disclaimer.
 ** * Redistributions in binary form must reproduce the above copyright
 ** notice, this list of conditions and the following disclaimer in
 ** the documentation and/or other materials provided with the
 ** distribution.
 ** * Neither the name of The Qt Company Ltd nor the names of its
 ** contributors may be used to endorse or promote products derived
 ** from this software without specific prior written permission.
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
#include "compositor.h"
#include "window.h"
#include <QtWaylandCompositor/QWaylandOutput>
#include <QtWaylandCompositor/QWaylandSeat>
#include <QRandomGenerator>
#include <QOpenGLFunctions>
View::View() {}
QOpenGLTexture *View::getTexture()
{
    if (advance())
        m_texture = currentBuffer().toOpenGLTexture();
    return m_texture;
}
QPoint View::mapToLocal(const QPoint &globalPos) const
{
    return globalPos - globalPosition();
}
void View::initPosition(const QSize &screenSize, const QSize &surfaceSize)
{
    int xrange = qMax(screenSize.width() - surfaceSize.width(), 1);
    int yrange = qMax(screenSize.height() - surfaceSize.height(), 1);
    setGlobalPosition(QPoint(QRandomGenerator::global()->bounded(xrange), QRandomGenerator::global()->bounded(yrange)));
}
Compositor::Compositor(Window *window)
: m_window(window)
{
    window->setCompositor(this);
    connect(window, &Window::glReady, this, &Compositor::create);
}
Compositor::~Compositor()
{
}
void Compositor::create()
{
    QWaylandOutput *output = new QWaylandOutput(this, m_window);
    QWaylandOutputMode mode(m_window->size(), 60000);
    output->addMode(mode, true);
    QWaylandCompositor::create();
    output->setCurrentMode(mode);
    m_xdgShell = new QWaylandXdgShell(this);
    connect(m_xdgShell, &QWaylandXdgShell::toplevelCreated, this, &Compositor::onToplevelCreated);
    m_wlShell = new QWaylandWlShell(this);
    connect(m_wlShell, &QWaylandWlShell::wlShellSurfaceCreated, this, &Compositor::onShellSurfaceCreated);
}
View *Compositor::viewAt(const QPoint &position)
{
    for (auto it = m_views.crbegin(); it != m_views.crend(); ++it) {
        View *view = *it;
        if (view->globalGeometry().contains(position))
            return view;
    }
    return nullptr;
}
void Compositor::raise(View *view)
{
    m_views.removeAll(view);
    m_views.append(view);
    defaultSeat()->setKeyboardFocus(view->surface());
    triggerRender();
}
static inline QPoint mapToView(const View *view, const QPoint &position)
{
    return view ? view->mapToLocal(position) : position;
}
void Compositor::handleMousePress(const QPoint &position, Qt::MouseButton button)
{
    if (m_mouseView.isNull()) {
        m_mouseView = viewAt(position);
        if (m_mouseView)
            raise(m_mouseView);
    }
    auto seat = defaultSeat();
    seat->sendMouseMoveEvent(m_mouseView, mapToView(m_mouseView.data(), position));
    seat->sendMousePressEvent(button);
    if (button == Qt::LeftButton && m_altPressed && m_mouseView) {
        m_grabbedView = m_mouseView;
        m_grabPos = position - m_mouseView->globalPosition();
        // Don't send the press to the client since we're using it for move
        seat->sendMouseReleaseEvent(button);
        return;
    }
}
void Compositor::handleMouseRelease(const QPoint &position, Qt::MouseButton button, Qt::MouseButtons buttons)
{
    auto seat = defaultSeat();
    seat->sendMouseMoveEvent(m_mouseView, mapToView(m_mouseView.data(), position));
    seat->sendMouseReleaseEvent(button);
    if (m_grabbedView) {
        m_grabbedView = nullptr;
    }
    if (buttons == Qt::NoButton) {
        View *newView = viewAt(position);
        if (newView != m_mouseView)
            seat->sendMouseMoveEvent(newView, mapToView(newView, position));
        m_mouseView = nullptr;
    }
}
void Compositor::handleMouseMove(const QPoint &position)
{
    if (m_grabbedView) {
        m_grabbedView->setGlobalPosition(position - m_grabPos);
        triggerRender();
        return;
    }
    View *view = m_mouseView ? m_mouseView.data() : viewAt(position);
    defaultSeat()->sendMouseMoveEvent(view, mapToView(view, position));
}
void Compositor::handleMouseWheel(const QPoint &angleDelta)
{
    if (angleDelta.x() != 0)
        defaultSeat()->sendMouseWheelEvent(Qt::Horizontal, angleDelta.x());
    if (angleDelta.y() != 0)
        defaultSeat()->sendMouseWheelEvent(Qt::Vertical, angleDelta.y());
}
void Compositor::handleKeyPress(quint32 nativeScanCode)
{
    if (nativeScanCode == 64 || nativeScanCode == 108)
        m_altPressed = true;
    defaultSeat()->sendKeyPressEvent(nativeScanCode);
}
void Compositor::handleKeyRelease(quint32 nativeScanCode)
{
    if (nativeScanCode == 64 || nativeScanCode == 108)
        m_altPressed = false;
    defaultSeat()->sendKeyReleaseEvent(nativeScanCode);
}
void Compositor::onToplevelCreated(QWaylandXdgToplevel *toplevel, QWaylandXdgSurface *xdgSurface)
{
    QWaylandSurface *surface = xdgSurface->surface();
    View *view = new View;
    view->setSurface(surface);
    view->setToplevel(toplevel);
    view->setOutput(outputFor(m_window));
    // Window rules example
    if (toplevel->appId() == "terminal") {
        view->setGlobalPosition(QPoint(100, 100));
    } else {
        view->initPosition(m_window->size(), surface->destinationSize());
    }
    m_views.append(view);
    connect(view, &QWaylandView::surfaceDestroyed, this, &Compositor::viewSurfaceDestroyed);
    connect(surface, &QWaylandSurface::redraw, this, &Compositor::triggerRender);
    raise(view);
    if (m_tiling) arrange();
}
void Compositor::onShellSurfaceCreated(QWaylandWlShellSurface *shellSurface)
{
    View *view = new View;
    view->setSurface(shellSurface->surface());
    view->setShellSurface(shellSurface);
    view->setOutput(outputFor(m_window));
    view->initPosition(m_window->size(), shellSurface->surface()->destinationSize());
    m_views.append(view);
    connect(view, &QWaylandView::surfaceDestroyed, this, &Compositor::viewSurfaceDestroyed);
    connect(shellSurface->surface(), &QWaylandSurface::redraw, this, &Compositor::triggerRender);
    raise(view);
    if (m_tiling) arrange();
}
void Compositor::viewSurfaceDestroyed()
{
    View *view = qobject_cast<View*>(sender());
    m_views.removeAll(view);
    delete view;
    triggerRender();
}
void Compositor::triggerRender()
{
    m_window->requestUpdate();
}
void Compositor::startRender()
{
    QWaylandOutput *out = defaultOutput();
    if (out)
        out->frameStarted();
}
void Compositor::endRender()
{
    QWaylandOutput *out = defaultOutput();
    if (out)
        out->sendFrameCallbacks();
}
void Compositor::toggleTiling()
{
    m_tiling = !m_tiling;
    if (m_tiling) {
        arrange();
    } else {
        for (View *view : m_views) {
            view->initPosition(m_window->size(), view->size());
        }
    }
    triggerRender();
}
void Compositor::arrange()
{
    QSize screenSize = m_window->size();
    int n = m_views.count();
    if (n == 0) return;
    int w = screenSize.width() / n;
    int x = 0;
    for (View *view : m_views) {
        view->setGlobalPosition(QPoint(x, 0));
        QSize newSize(w, screenSize.height());
        if (view->toplevel()) {
            view->toplevel()->sendConfigure(newSize, QList<QWaylandXdgToplevel::State>());
        } // For wl_shell, no configure, client may not resize
        x += w;
    }
}
