"""Patch funasr Fun-ASR-Nano to pass attention_mask to LLM generate, fixing the warning:
'The attention mask is not set and cannot be inferred from input because pad token is same as eos token'
"""


def apply_funasr_attention_mask_patch():
    """Apply patch to FunASRNano.inference_llm to pass attention_mask to generate (fixes warning)."""
    try:
        import torch
        from funasr.models.fun_asr_nano import model as fun_asr_nano_module

        if getattr(fun_asr_nano_module.FunASRNano, "_whoasr_attention_mask_patched", False):
            return

        _orig_inference_llm = fun_asr_nano_module.FunASRNano.inference_llm

        def _patched_inference_llm(self, data_in, data_lengths=None, key=None, tokenizer=None, frontend=None, **kwargs):
            # Call original - we need to patch the generate call inside
            # The cleanest: patch self.llm.generate to accept attention_mask
            # We'll wrap the original method and inject attention_mask via a temporary
            # monkey-patch on the llm.generate call
            orig_llm_generate = self.llm.generate

            def _generate_with_mask(*args, **gen_kwargs):
                if "attention_mask" not in gen_kwargs and "inputs_embeds" in gen_kwargs:
                    embeds = gen_kwargs["inputs_embeds"]
                    gen_kwargs["attention_mask"] = torch.ones(
                        embeds.shape[0],
                        embeds.shape[1],
                        dtype=torch.long,
                        device=embeds.device,
                    )
                return orig_llm_generate(*args, **gen_kwargs)

            try:
                self.llm.generate = _generate_with_mask
                return _orig_inference_llm(self, data_in, data_lengths, key, tokenizer, frontend, **kwargs)
            finally:
                self.llm.generate = orig_llm_generate

        fun_asr_nano_module.FunASRNano.inference_llm = _patched_inference_llm
        fun_asr_nano_module.FunASRNano._whoasr_attention_mask_patched = True
    except Exception:
        pass