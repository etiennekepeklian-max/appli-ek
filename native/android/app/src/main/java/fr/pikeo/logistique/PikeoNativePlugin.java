package fr.pikeo.logistique;
import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.*;
import android.util.Base64;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name="PikeoNative",permissions={@com.getcapacitor.annotation.Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class PikeoNativePlugin extends Plugin {
 private KeyStore keys() throws Exception {KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);return s;}
 private KeyStore.PrivateKeyEntry identity() throws Exception {
  KeyStore s=keys();if(!s.containsAlias("pikeo-device")){KeyPairGenerator g=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");g.initialize(new KeyGenParameterSpec.Builder("pikeo-device",KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());g.generateKeyPair();}
  return (KeyStore.PrivateKeyEntry)keys().getEntry("pikeo-device",null);
 }
 private boolean notificationAccess(){String enabled=Settings.Secure.getString(getContext().getContentResolver(),"enabled_notification_listeners");return enabled!=null&&enabled.contains(new ComponentName(getContext(),PikeoMediaListener.class).flattenToString());}
 @PluginMethod public void capabilities(PluginCall c){JSObject r=new JSObject();r.put("overlay",Settings.canDrawOverlays(getContext()));r.put("notificationAccess",notificationAccess());r.put("notifications",Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);r.put("exactAlarms",Build.VERSION.SDK_INT<31||getContext().getSystemService(AlarmManager.class).canScheduleExactAlarms());r.put("platform","android");c.resolve(r);}
 @PluginMethod public void deviceKey(PluginCall c){try{byte[] p=identity().getCertificate().getPublicKey().getEncoded();MessageDigest d=MessageDigest.getInstance("SHA-256");JSObject r=new JSObject();r.put("publicKey",Base64.encodeToString(p,Base64.NO_WRAP));r.put("fingerprint",hex(d.digest(p)));c.resolve(r);}catch(Exception e){c.reject("Clé Android indisponible",e);}}
 @PluginMethod public void sign(PluginCall c){try{String p=c.getString("payload");if(p==null||p.length()>3000000)throw new Exception("Données invalides");Signature s=Signature.getInstance("SHA256withECDSA");s.initSign(identity().getPrivateKey());s.update(p.getBytes(StandardCharsets.UTF_8));JSObject r=new JSObject();r.put("signature",Base64.encodeToString(s.sign(),Base64.NO_WRAP));c.resolve(r);}catch(Exception e){c.reject("Signature Android indisponible",e);}}
 private String hex(byte[] a){StringBuilder s=new StringBuilder();for(byte b:a)s.append(String.format("%02x",b));return s.toString();}
 @PluginMethod public void music(PluginCall c){
  if(!Settings.canDrawOverlays(getContext())){getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getContext().getPackageName())));JSObject r=new JSObject();r.put("step","overlay");c.resolve(r);return;}
  if(!notificationAccess()){getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));JSObject r=new JSObject();r.put("step","notificationAccess");c.resolve(r);return;}
  ContextCompat.startForegroundService(getContext(),new Intent(getContext(),PikeoMusicService.class));JSObject r=new JSObject();r.put("shown",true);c.resolve(r);
 }
 @PluginMethod public void hideMusic(PluginCall c){getContext().stopService(new Intent(getContext(),PikeoMusicService.class));c.resolve();}
 @PluginMethod public void scheduleAlarm(PluginCall c){try{String id=c.getString("id");Long at=c.getLong("at");if(id==null||!id.matches("[a-zA-Z0-9_-]{1,100}")||at==null||at<=System.currentTimeMillis())throw new Exception("Échéance invalide");boolean exact=PikeoAlarmReceiver.schedule(getContext(),id,at,c.getString("title","Pikéo — tâche à vérifier"));JSObject r=new JSObject();r.put("exact",exact);c.resolve(r);}catch(Exception e){c.reject("Rappel non programmé",e);}}
 @PluginMethod public void cancelAlarm(PluginCall c){PikeoAlarmReceiver.cancel(getContext(),c.getString("id",""));c.resolve();}
 @PluginMethod public void requestNotifications(PluginCall c){if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED)requestPermissionForAlias("notifications",c,"notificationResult");else c.resolve();}
 @PermissionCallback private void notificationResult(PluginCall c){capabilities(c);}
 @PluginMethod public void openAlarmSettings(PluginCall c){if(Build.VERSION.SDK_INT>=31)getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())));c.resolve();}
 private javax.crypto.SecretKey vaultKey() throws Exception {if(!keys().containsAlias("pikeo-vault")){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("pikeo-vault",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return ((KeyStore.SecretKeyEntry)keys().getEntry("pikeo-vault",null)).getSecretKey();}
 private String safeName(PluginCall c) throws Exception {String k=c.getString("key");if(k==null||!k.matches("[a-zA-Z0-9_-]{1,120}"))throw new Exception("Nom invalide");return k;}
 @PluginMethod public void vaultPut(PluginCall c){try{String k=safeName(c),value=c.getString("value","");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,vaultKey());String out=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);getContext().getSharedPreferences("pikeo_vault",0).edit().putString(k,out).commit();c.resolve();}catch(Exception e){c.reject("Sauvegarde privée impossible",e);}}
 @PluginMethod public void vaultGet(PluginCall c){try{String raw=getContext().getSharedPreferences("pikeo_vault",0).getString(safeName(c),null);JSObject out=new JSObject();if(raw!=null){String[] a=raw.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,vaultKey(),new GCMParameterSpec(128,Base64.decode(a[0],Base64.DEFAULT)));out.put("value",new String(cipher.doFinal(Base64.decode(a[1],Base64.DEFAULT)),StandardCharsets.UTF_8));}c.resolve(out);}catch(Exception e){c.reject("Lecture privée impossible",e);}}
 @PluginMethod public void vaultDelete(PluginCall c){try{getContext().getSharedPreferences("pikeo_vault",0).edit().remove(safeName(c)).commit();c.resolve();}catch(Exception e){c.reject("Suppression privée impossible",e);}}
 @PluginMethod public void sensitive(PluginCall c){boolean enabled=c.getBoolean("enabled",false);getActivity().runOnUiThread(()->{if(enabled)getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);c.resolve();});}
 @PluginMethod public void exportFile(PluginCall c){String name=c.getString("name","Pikeo-export.json");Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(c.getString("mime","application/octet-stream"));i.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[/\\\\]","_"));startActivityForResult(c,i,"exportResult");}
 @ActivityCallback private void exportResult(PluginCall c,ActivityResult result){if(c==null)return;if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){JSObject r=new JSObject();r.put("cancelled",true);c.resolve(r);return;}try(OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData())){out.write(Base64.decode(c.getString("data",""),Base64.DEFAULT));c.resolve();}catch(Exception e){c.reject("Export impossible",e);}}
}
