"""
Dev server entrypoint.

Must be used instead of `python -m uvicorn main:app` on Windows: uvicorn's
own startup creates a ProactorEventLoop before main.py is ever imported,
which is incompatible with psycopg's async driver. Setting the event loop
policy here, before uvicorn.run() creates the loop, is what actually takes
effect.
"""

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
