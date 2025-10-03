import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function NotFound() {
	useDocumentTitle("页面未找到");

	return (
		<section className="flex flex-col items-center justify-center min-h-[60vh] text-center">
			<h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
			<h2 className="text-2xl font-semibold text-foreground mb-2">页面未找到</h2>
			<p className="text-muted-foreground mb-6">抱歉，您访问的页面不存在或已被移动。</p>
			<a href="/" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90">
				返回首页
			</a>
		</section>
	);
}
