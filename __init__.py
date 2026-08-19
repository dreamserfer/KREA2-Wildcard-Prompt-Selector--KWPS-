from .comfyui_kwps import KREA2PromptBuilder

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {
    "KREA2PromptBuilder": KREA2PromptBuilder
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "KREA2PromptBuilder": "ComfyUI-KREA2-Wildcard-Prompt-Selector-(KWPS)"
}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]