import {Capacitor,registerPlugin} from '@capacitor/core';
const native=registerPlugin('PikeoNative');
if(Capacitor.isNativePlatform()){
 globalThis.PikeoNative={isNative:true,...Object.fromEntries(['capabilities','deviceKey','sign','music','hideMusic','scheduleAlarm','cancelAlarm','requestNotifications','openAlarmSettings','vaultPut','vaultGet','vaultDelete','exportFile','sensitive'].map(name=>[name,values=>native[name](values||{})]))};
}
