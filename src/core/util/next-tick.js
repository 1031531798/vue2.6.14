/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

// 是否使用微任务
export let isUsingMicroTask = false

// 收集一次tick中所有的事件回调 这样就不用开启多个tick
const callbacks = []
let pending = false

// 遍历所有回调函数  并执行
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks. 这里有使用微任务的异步推送封装器
// In 2.5 we used (macro) tasks (in combination with microtasks). 在2.5版本中我们使用了宏任务（结合了微任务）
// However, it has subtle problems when state is changed right before repaint 但是在重绘之前改变状态会有一些不易察觉的问题
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors 此外 在事件处理程序中使用宏任务也会导致一些奇怪的问题
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109). 这是无法回避的
// So we now use microtasks everywhere, again. 所以我们在任何地方都是用微任务
// A major drawback of this tradeoff is that there are some scenarios 这种权衡的一个主要缺点是有一些场景
// where microtasks have too high a priority and fire in between supposedly 微任务的优先级太高，并且在两者之间触发
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
// nextTick行为利用可访问的微任务队列

//通过native Promise。然后或MutationObserver。
// MutationObserver有更广泛的支持，但是它有严重的bug
// UIWebView在iOS >= 9.3.3时触发的触摸事件处理程序。它
//触发几次后完全停止工作…所以,如果本地
// Promise是可用的，我们将使用它:
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  // 直接获取一个 成功的promise对象
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
