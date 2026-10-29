package com.pikeo.preparation.media;

import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.util.Iterator;

/** Optional Capacitor facade, deliberately outside any built Android project. */
@CapacitorPlugin(name = "PikeoMedia")
public final class PikeoMediaPlugin extends Plugin {
    private PikeoMediaController media;
    private static JSObject js(JSONObject value) {
        JSObject result = new JSObject();
        Iterator<String> keys = value.keys();
        while (keys.hasNext()) { String key = keys.next(); result.put(key, value.opt(key)); }
        return result;
    }
    private void ensure() {
        if (media == null) media = new PikeoMediaController(getContext(), state -> notifyListeners("stateChanged", js(state)));
    }
    @Override public void load() { getActivity().runOnUiThread(() -> { ensure(); media.start(); }); }
    @Override protected void handleOnResume() { getActivity().runOnUiThread(() -> { ensure(); media.start(); }); }
    @Override protected void handleOnStop() { if (media != null) getActivity().runOnUiThread(() -> media.stop()); }
    @Override protected void handleOnDestroy() { if (media != null) getActivity().runOnUiThread(() -> media.stop()); }
    @PluginMethod public void getState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try { ensure(); call.resolve(js(media.getState())); }
            catch (Exception error) { call.reject("Impossible de lire les commandes multimédias.", "MEDIA_STATE", error); }
        });
    }
    @PluginMethod public void command(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                ensure();
                boolean accepted = media.command(call.getString("sessionId", ""), call.getString("action", ""), call.getString("expectedStatus", ""));
                JSObject result = new JSObject(); result.put("accepted", accepted); call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage(), "MEDIA_COMMAND", error); }
        });
    }
    @PluginMethod public void openAccessSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                JSObject result = new JSObject(); result.put("opened", true); call.resolve(result);
            } catch (Exception error) { call.reject("Ouvrez l’accès aux notifications dans les réglages Android.", "MEDIA_SETTINGS", error); }
        });
    }
}
