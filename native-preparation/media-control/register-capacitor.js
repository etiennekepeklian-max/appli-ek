// Preparation only. Load and bundle BEFORE Pikéo's web entry point after migration approval.
import {Capacitor,registerPlugin} from '@capacitor/core';
if(Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android'){
 globalThis.PikeoMediaBridge=registerPlugin('PikeoMedia');
}
