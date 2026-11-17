package fr.pikeo.logistique;
import android.app.*;
import android.content.*;
import android.graphics.PixelFormat;
import android.media.session.*;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import androidx.core.app.NotificationCompat;
import java.util.*;
public class PikeoMusicService extends Service {
 private WindowManager windows;private ImageButton button;private WindowManager.LayoutParams layout;private MediaController controller;
 private final Handler handler=new Handler(Looper.getMainLooper());private final Runnable refresh=new Runnable(){public void run(){update();handler.postDelayed(this,1500);}};
 public IBinder onBind(Intent i){return null;}
 public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel("pikeo_music","Bouton Lecture/Pause",NotificationManager.IMPORTANCE_LOW));Intent open=new Intent(this,MainActivity.class);PendingIntent p=PendingIntent.getActivity(this,1,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);startForeground(41,new NotificationCompat.Builder(this,"pikeo_music").setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("Pikéo — Lecture/Pause").setContentText("Bouton musical actif. Désactivation dans Pikéo.").setContentIntent(p).setOngoing(true).build());
  if(!Settings.canDrawOverlays(this)){stopSelf();return;}windows=getSystemService(WindowManager.class);button=new ImageButton(this);button.setImageResource(android.R.drawable.ic_media_play);button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xfff7d64d));int size=(int)(56*getResources().getDisplayMetrics().density);layout=new WindowManager.LayoutParams(size,size,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT);layout.gravity=Gravity.TOP|Gravity.LEFT;layout.x=8;layout.y=200;windows.addView(button,layout);
  button.setOnClickListener(v->{update();if(controller==null){Toast.makeText(this,"Ouvrez votre lecteur musical et démarrez un titre.",Toast.LENGTH_SHORT).show();return;}PlaybackState s=controller.getPlaybackState();if(s!=null&&s.getState()==PlaybackState.STATE_PLAYING)controller.getTransportControls().pause();else controller.getTransportControls().play();handler.postDelayed(()->update(),250);});
  button.setOnTouchListener(new View.OnTouchListener(){float x,y;int left,top;boolean moved;public boolean onTouch(View v,android.view.MotionEvent e){if(e.getAction()==MotionEvent.ACTION_DOWN){x=e.getRawX();y=e.getRawY();left=layout.x;top=layout.y;moved=false;return true;}if(e.getAction()==MotionEvent.ACTION_MOVE){float dx=e.getRawX()-x,dy=e.getRawY()-y;if(Math.abs(dx)+Math.abs(dy)>12)moved=true;if(moved){layout.x=left+(int)dx;layout.y=top+(int)dy;windows.updateViewLayout(button,layout);}return true;}if(e.getAction()==MotionEvent.ACTION_UP){if(!moved)v.performClick();return true;}return false;}});handler.post(refresh);
 }
 private void update(){if(button==null)return;try{List<MediaController> list=getSystemService(MediaSessionManager.class).getActiveSessions(new ComponentName(this,PikeoMediaListener.class));controller=null;for(MediaController c:list){PlaybackState s=c.getPlaybackState();if(s!=null&&s.getState()==PlaybackState.STATE_PLAYING){controller=c;break;}}if(controller==null)for(MediaController c:list)if(c.getPackageName().equals("com.google.android.apps.youtube.music")){controller=c;break;}if(controller==null&&!list.isEmpty())controller=list.get(0);boolean playing=controller!=null&&controller.getPlaybackState()!=null&&controller.getPlaybackState().getState()==PlaybackState.STATE_PLAYING;button.setImageResource(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play);button.setContentDescription(playing?"Mettre la musique en pause":"Reprendre la musique");}catch(SecurityException e){controller=null;}}
 public int onStartCommand(Intent i,int f,int id){return START_NOT_STICKY;}
 public void onDestroy(){handler.removeCallbacksAndMessages(null);if(button!=null&&windows!=null)windows.removeView(button);super.onDestroy();}
}
