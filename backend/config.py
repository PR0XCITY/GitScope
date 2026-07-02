from dotenv import load_dotenv
import os

load_dotenv()

GITHUB_TOKEN      = os.getenv("GITHUB_TOKEN")
SUPABASE_URL      = os.getenv("SUPABASE_URL")
SUPABASE_KEY      = os.getenv("SUPABASE_SERVICE_KEY")
GROQ_API_KEY      = os.getenv("GROQ_API_KEY")
LLM_MODEL         = "llama-3.3-70b-versatile"