import { useLocation } from "preact-iso";

export function Header() {
  const { url } = useLocation();

  const navigationItems = [
    { href: "/", label: "首页" },
    { href: "/asr", label: "实时转换" },
    { href: "/asr-offline", label: "离线转换" },
    { href: "/punctuation", label: "标点添加" },
    { href: "/vad", label: "语音活动检测" },
    { href: "/timestamp", label: "时间戳预测" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background px-4">
      <div className="container flex h-14 w-full items-center">
        <a className="mr-8 flex items-center space-x-2 gap-2" href="/">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg
              className="h-4 w-4 text-primary-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="font-bold text-lg">WhoASR</span>
        </a>

        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-foreground ${
                url === item.href
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
