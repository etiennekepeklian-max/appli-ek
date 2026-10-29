package com.pikeo.preparation.media;

import android.service.notification.NotificationListenerService;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Preparation only. No notification body, audio, title or media history is read.
 * The special Android notification-access grant is still broader than media controls.
 */
public final class PikeoMediaAccessService extends NotificationListenerService {
    static final Set<Runnable> accessListeners = new CopyOnWriteArraySet<>();
    private void changed() { for (Runnable listener : accessListeners) listener.run(); }
    @Override public void onListenerConnected() { super.onListenerConnected(); changed(); }
    @Override public void onListenerDisconnected() { super.onListenerDisconnected(); changed(); }
}
