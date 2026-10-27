export const OCR_PAGE_TIMEOUT_MS=60000;
export const ocrAbortError=()=>Object.assign(Error('Analyse mise en pause. Les photos et les lectures terminées sont conservées.'),{name:'AbortError'});
const reason=signal=>signal.reason instanceof Error?signal.reason:ocrAbortError();

export function abortableOCR(promise,signal){
  if(!signal)return Promise.resolve(promise);
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(reason(signal));};
    signal.addEventListener('abort',abort,{once:true});
    // Observe late errors as well, including workers terminated during a read.
    Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(reason(signal));else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
    if(signal.aborted)abort();
  });
}

export async function boundedOCR(task,{signal,timeoutMs=OCR_PAGE_TIMEOUT_MS,onInterrupt=()=>{}}={}){
  if(signal?.aborted)throw reason(signal);
  const controller=new AbortController();
  const stop=error=>{if(controller.signal.aborted)return;controller.abort(error);onInterrupt();};
  const abort=()=>stop(reason(signal));
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>stop(Object.assign(Error('Lecture trop longue : la limite par photo est atteinte. La photo est conservée ; relancez-la ou vérifiez-la manuellement.'),{name:'OCRTimeoutError',code:'OCR_TIMEOUT'})),timeoutMs);
  try{return await abortableOCR(Promise.resolve().then(()=>{if(controller.signal.aborted)throw reason(controller.signal);return task(controller.signal);}),controller.signal);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
