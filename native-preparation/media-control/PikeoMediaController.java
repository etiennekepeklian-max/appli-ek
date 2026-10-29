package com.pikeo.preparation.media;

import android.content.ComponentName;
import android.content.Context;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Platform core to integrate and compile at migration time, on the Android main thread.
 * No app whitelist, file access, networking, notification scraping or durable storage.
 */
public final class PikeoMediaController {
    public interface Listener { void changed(JSONObject state); }
    private final Context context;
    private final MediaSessionManager manager;
    private final ComponentName listenerComponent;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<MediaSession.Token, Entry> entries = new LinkedHashMap<>();
    private final Listener listener;
    private boolean watching;
    private boolean running;
    private final Runnable accessChanged = () -> handler.post(() -> { if (running) { stopWatching(); start(); } });
    private final MediaSessionManager.OnActiveSessionsChangedListener sessionsChanged = controllers -> publish();
    private final class Entry {
        final String id = UUID.randomUUID().toString();
        final MediaController controller;
        final MediaController.Callback callback = new MediaController.Callback() {
            @Override public void onPlaybackStateChanged(PlaybackState state) { publish(); }
            @Override public void onSessionDestroyed() { publish(); }
        };
        Entry(MediaController value) { controller = value; controller.registerCallback(callback, handler); }
        void release() { controller.unregisterCallback(callback); }
    }
    public PikeoMediaController(Context value, Listener listener) {
        context = value.getApplicationContext();
        manager = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        listenerComponent = new ComponentName(context, PikeoMediaAccessService.class);
        this.listener = listener;
    }
    private void assertMainThread() {
        if (Looper.myLooper() != Looper.getMainLooper()) throw new IllegalStateException("Thread Android principal requis.");
    }
    public void start() {
        assertMainThread();
        running = true;
        PikeoMediaAccessService.accessListeners.add(accessChanged);
        if (manager != null && !watching) {
            try { manager.addOnActiveSessionsChangedListener(sessionsChanged, listenerComponent, handler); watching = true; }
            catch (SecurityException denied) { watching = false; }
        }
        publish();
    }
    private void stopWatching() {
        if (manager != null && watching) manager.removeOnActiveSessionsChangedListener(sessionsChanged);
        watching = false;
    }
    public void stop() {
        assertMainThread(); running = false; stopWatching();
        PikeoMediaAccessService.accessListeners.remove(accessChanged);
        for (Entry entry : entries.values()) entry.release();
        entries.clear();
    }
    private static String status(PlaybackState state) {
        if (state == null) return "unknown";
        switch (state.getState()) {
            case PlaybackState.STATE_PLAYING: return "playing";
            case PlaybackState.STATE_PAUSED: return "paused";
            case PlaybackState.STATE_BUFFERING: return "buffering";
            case PlaybackState.STATE_CONNECTING: return "connecting";
            case PlaybackState.STATE_STOPPED: return "stopped";
            case PlaybackState.STATE_ERROR: return "error";
            default: return "unknown";
        }
    }
    private static boolean supports(PlaybackState state, long action) {
        return state != null && (state.getActions() & (action | PlaybackState.ACTION_PLAY_PAUSE)) != 0;
    }
    private String label(MediaController controller) {
        String name = controller.getPackageName();
        try { return context.getPackageManager().getApplicationLabel(context.getPackageManager().getApplicationInfo(name, 0)).toString(); }
        catch (Exception unavailable) { return name; }
    }
    private void clearEntries() { for (Entry entry : entries.values()) entry.release(); entries.clear(); }
    public JSONObject getState() throws JSONException {
        assertMainThread();
        JSONObject result = new JSONObject().put("schema", 1).put("platform", "android").put("supported", manager != null);
        JSONArray rows = new JSONArray(); result.put("sessions", rows);
        if (manager == null) return result.put("permission", "unsupported");
        List<MediaController> active;
        try { active = manager.getActiveSessions(listenerComponent); }
        catch (SecurityException denied) { clearEntries(); return result.put("permission", "required"); }
        result.put("permission", "granted");
        List<MediaSession.Token> live = new ArrayList<>();
        for (MediaController controller : active) {
            // Pikéo's own memos must not be confused with external music.
            if (context.getPackageName().equals(controller.getPackageName())) continue;
            MediaSession.Token token = controller.getSessionToken(); live.add(token);
            Entry entry = entries.get(token);
            if (entry == null) { entry = new Entry(controller); entries.put(token, entry); }
            PlaybackState state = entry.controller.getPlaybackState();
            rows.put(new JSONObject().put("id", entry.id).put("label", label(entry.controller))
                .put("status", status(state)).put("canPlay", supports(state, PlaybackState.ACTION_PLAY))
                .put("canPause", supports(state, PlaybackState.ACTION_PAUSE)));
        }
        for (MediaSession.Token token : new ArrayList<>(entries.keySet())) if (!live.contains(token)) entries.remove(token).release();
        return result;
    }
    private void publish() {
        if (!running) return;
        try { listener.changed(getState()); }
        catch (JSONException impossible) { throw new IllegalStateException(impossible); }
    }
    public boolean command(String sessionId, String action, String expectedStatus) throws JSONException {
        assertMainThread();
        if (!"play".equals(action) && !"pause".equals(action)) throw new IllegalArgumentException("Commande inconnue.");
        if (!"granted".equals(getState().optString("permission"))) throw new SecurityException("Autorisez l’accès aux notifications puis réessayez.");
        Entry target = null;
        for (Entry entry : entries.values()) if (entry.id.equals(sessionId)) { target = entry; break; }
        if (target == null) throw new IllegalStateException("Ce lecteur n’est plus disponible.");
        PlaybackState state = target.controller.getPlaybackState();
        String current = status(state);
        if (!current.equals(expectedStatus)) throw new IllegalStateException("La lecture a changé. Vérifiez puis réessayez.");
        boolean pause = "pause".equals(action);
        boolean appropriate = pause ? ("playing".equals(current) || "buffering".equals(current) || "connecting".equals(current))
            : ("paused".equals(current) || "stopped".equals(current));
        long flag = pause ? PlaybackState.ACTION_PAUSE : PlaybackState.ACTION_PLAY;
        if (!appropriate || !supports(state, flag)) throw new IllegalStateException("Commande non disponible pour ce lecteur.");
        if ((state.getActions() & flag) != 0) {
            if (pause) target.controller.getTransportControls().pause(); else target.controller.getTransportControls().play();
        } else {
            // For toggle-only sessions, address BOTH key events to this exact controller.
            boolean accepted = target.controller.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE));
            target.controller.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE));
            if (!accepted) return false;
        }
        // Dispatch is not a confirmation of playback. The UI waits for the actual state.
        return true;
    }
}
