from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/macro_momentum"
    FRED_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-key"

    class Config:
        env_file = ".env"


settings = Settings()
