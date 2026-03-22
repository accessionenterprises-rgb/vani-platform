from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_service_key: str
    environment: str = "development"
    port: int = 8000

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_api_key: str = ""
    twilio_api_secret: str = ""
    twilio_twiml_app_sid: str = ""
    twilio_caller_id: str = "+19209209967"

    # Admin panel — set ADMIN_SECRET on Railway
    admin_secret: str = "vani-admin-change-me"

    # Anthropic — set ANTHROPIC_API_KEY on Railway for AI memorability scoring
    anthropic_api_key: str = ""


settings = Settings()
