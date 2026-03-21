"""Minimal agent to confirm dispatch routing works."""
import sys
import os
from dotenv import load_dotenv
from livekit.agents import AgentServer, JobContext, cli

load_dotenv(".env.local")

server = AgentServer()


@server.rtc_session(agent_name="vani-agent")
async def vani_agent(ctx: JobContext):
    print(">>> ENTRYPOINT CALLED <<<", flush=True)
    sys.stdout.flush()
    await ctx.connect()
    print(">>> CONNECTED TO ROOM <<<", flush=True)
    sys.stdout.flush()
    # Just stay connected for 30 seconds
    import asyncio
    await asyncio.sleep(30)


if __name__ == "__main__":
    cli.run_app(server)
