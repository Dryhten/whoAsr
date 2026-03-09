"""文本后处理工具：中文数字转阿拉伯数字等"""

import re

# 中文数字字符映射（幺=1 口语，两=2 口语）
_CN_DIGIT_MAP = {
    "零": "0", "〇": "0",
    "一": "1", "幺": "1",
    "二": "2", "两": "2",
    "三": "3", "四": "4", "五": "5",
    "六": "6", "七": "7", "八": "8", "九": "9",
}


def chinese_numbers_to_arabic(text: str) -> str:
    """
    将连续三位及以上中文数字（如 幺二零、一二三）转为阿拉伯数字。
    用于补足 itn 未覆盖的口语表述（如 幺 代替 一）。
    """
    if not text or not isinstance(text, str):
        return text

    # 匹配连续 3 个及以上中文数字字符
    pattern = re.compile(
        r"([零〇一二三四五六七八九幺两]{3,})",
        re.UNICODE,
    )

    def _replace(m: re.Match) -> str:
        s = m.group(1)
        return "".join(_CN_DIGIT_MAP.get(c, c) for c in s)

    return pattern.sub(_replace, text)


def apply_chinese_numbers_to_result(obj):
    """
    递归遍历 ASR 结果结构，对 text 字段应用 chinese_numbers_to_arabic。
    支持 list、dict、str 等嵌套结构。
    """
    if obj is None:
        return obj
    if isinstance(obj, str):
        return chinese_numbers_to_arabic(obj)
    if isinstance(obj, dict):
        return {k: apply_chinese_numbers_to_result(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [apply_chinese_numbers_to_result(x) for x in obj]
    return obj
