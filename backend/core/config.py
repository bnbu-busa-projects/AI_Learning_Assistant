import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def validate_config():
    if not os.getenv("MODEL_API_KEY"):
        print("Warning: no model API key is configured.")
