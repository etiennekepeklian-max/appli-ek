package fr.pikeo.logistique;
import java.util.Calendar;import java.util.TimeZone;
public final class WorkReminderTime {
 public static long nextAt(long now,int day,int minute){
  if(day<0||day>6||minute<0||minute>=1440)throw new IllegalArgumentException("Horaire invalide");
  Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("Europe/Paris"));cal.setTimeInMillis(now);cal.set(Calendar.HOUR_OF_DAY,minute/60);cal.set(Calendar.MINUTE,minute%60);cal.set(Calendar.SECOND,0);cal.set(Calendar.MILLISECOND,0);
  while(cal.get(Calendar.DAY_OF_WEEK)!=(day==0?1:day+1)||cal.getTimeInMillis()<=now+1000)cal.add(Calendar.DATE,1);
  return cal.getTimeInMillis();
 }
}
