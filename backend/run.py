"""
Dev server entrypoint.

Must be used instead of `python -m uvicorn main:app` on Windows: uvicorn's
own startup creates a ProactorEventLoop before main.py is ever imported,
which is incompatible with psycopg's async driver. Setting the event loop
policy here, before uvicorn.run() creates the loop, is what actually takes
effect.
"""

import asyncio
import selectors
import sys

if sys.platform == "win32":
    # Python 3.12+ on Windows defaults to ProactorEventLoop which psycopg
    # cannot use. Explicitly create and install a SelectorEventLoop before
    # uvicorn touches anything, then also set the policy so any loops created
    # later (e.g. in worker threads) also use the selector.
    _selector = selectors.SelectSelector()
    _loop = asyncio.SelectorEventLoop(_selector)
    asyncio.set_event_loop(_loop)
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, loop="none")
