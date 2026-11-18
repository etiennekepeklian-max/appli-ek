import fr.pikeo.logistique.WorkReminderTime;import java.time.Instant;
public class WorkReminderTimeCheck {
 static void check(String now,int day,int minute,String expected){long value=WorkReminderTime.nextAt(Instant.parse(now).toEpochMilli(),day,minute);if(value!=Instant.parse(expected).toEpochMilli())throw new AssertionError(Instant.ofEpochMilli(value));}
 public static void main(String[] args){check("2026-11-18T08:00:00Z",3,12*60+7,"2026-11-18T11:07:00Z");check("2026-11-18T11:07:10Z",3,12*60+7,"2026-11-25T11:07:00Z");check("2027-03-26T12:00:00Z",1,7*60+52,"2027-03-29T05:52:00Z");check("2027-10-29T12:00:00Z",1,7*60+52,"2027-11-01T06:52:00Z");try{WorkReminderTime.nextAt(0,9,500);throw new AssertionError();}catch(IllegalArgumentException expected){}System.out.println("Récurrence, rappel à -8 min et changements été/hiver validés.");}
}
