import os
import json
import server

DIR_PATH = os.path.dirname(os.path.realpath(__file__))
JSON_PATH = os.path.join(DIR_PATH, "wildcards.json")

class KREA2PromptBuilder:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "custom_text": ("STRING", {"multiline": True, "default": ""}),
                "selected_wildcards": ("STRING", {"multiline": True, "default": ""}), 
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "build_prompt"
    CATEGORY = "Dreamserfer"

    def build_prompt(self, custom_text, selected_wildcards):
        wildcards = selected_wildcards.strip()
        text = custom_text.strip()
        
        if wildcards and text:
            final_prompt = f"{text} ,{wildcards}"
        elif wildcards:
            final_prompt = wildcards
        else:
            final_prompt = text
            
        return (final_prompt,)

# --- API Endpoints ---

@server.PromptServer.instance.routes.get("/krea2/wildcards")
async def get_wildcards(request):
    from aiohttp import web
    try:
        if not os.path.exists(JSON_PATH):
            with open(JSON_PATH, "w") as f:
                json.dump({"categories": []}, f)

        with open(JSON_PATH, "r") as f:
            data = json.load(f)
        return web.json_response(data)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/krea2/wildcards_save")
async def save_wildcards(request):
    from aiohttp import web
    try:
        data = await request.json()
        with open(JSON_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)