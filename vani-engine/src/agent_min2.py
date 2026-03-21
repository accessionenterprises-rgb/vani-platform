"""Ultra-minimal agent — no plugins, just connect."""
import os
from dotenv import load_dotenv
from livekit.agents import AgentServer, JobContext, cli

load_dotenv(".env.local")

server = AgentServer()


@server.rtc_session(agent_name="vani-agent")
async def vani_agent(ctx: JobContext):
    import asyncio
    print(f">>> ENTRYPOINT: room={ctx.room.name} <<<", flush=True)
    await ctx.connect()
    print(">>> CONNECTED <<<", flush=True)
    await asyncio.sleep(60)


if __name__ == "__main__":
    cli.run_app(server)
