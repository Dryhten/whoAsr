from funasr import AutoModel

model = AutoModel(
    model="paraformer-zh",
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 60000},
    punc_model="ct-punc",
    spk_model="cam++",
)
wav_file = f"/home/linsoap/Videos/4f6f8c046d5175a5eff34b6bfe7b1f25.wav"
res = model.generate(
    input=wav_file, batch_size_s=300, batch_size_threshold_s=60, hotword="魔搭"
)
print(res)
