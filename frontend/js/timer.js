window.GameTimer=(()=>{
  let offset=0,interval=null,renderFn=()=>{};
  const ms=v=>v?new Date(v).getTime():null;
  function sync(serverNow){if(serverNow)offset=ms(serverNow)-Date.now()}
  function now(){return Date.now()+offset}
  function elapsed(start){const t=ms(start);return t==null?0:Math.max(0,(now()-t)/1000)}
  function format(sec){sec=Math.max(0,Number(sec)||0);const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${s.toFixed(1).padStart(4,'0')}`}
  function start(fn){renderFn=fn;clearInterval(interval);renderFn();interval=setInterval(renderFn,100)}
  function stop(){clearInterval(interval);interval=null}
  return {sync,now,elapsed,format,start,stop}
})();
