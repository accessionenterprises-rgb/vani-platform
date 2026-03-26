from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_service_key: str

    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    livekit_agent_name: str = "vani-agent"

    # Agora Conversational AI
    agora_app_id: str = ""
    agora_customer_key: str = ""
    agora_customer_secret: str = ""

    redis_url: str = "redis://localhost:6379"
    worker_count: int = 2
    post_processor_count: int = 1
    outbound_worker_count: int = 1

    openai_api_key: str = ""
    deepgram_api_key: str = ""
    cartesia_api_key: str = ""
    sarvam_api_key: str = ""
    mistral_api_key: str = ""
    groq_api_key: str = ""
    elevenlabs_api_key: str = ""
    orchestrator_public_url: str = "https://orchestrator.vani.live"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""

    environment: str = "development"
    port: int = 8001


settings = Settings()
