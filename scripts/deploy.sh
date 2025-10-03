#!/bin/bash

# whoAsr 生产环境部署脚本
# 使用方法: ./scripts/deploy.sh [环境] [选项]
# 环境: dev, staging, production

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
whoAsr 部署脚本

使用方法:
    $0 [环境] [选项]

环境:
    dev         开发环境部署
    staging     测试环境部署
    production  生产环境部署 (默认)

选项:
    --build     强制重新构建镜像
    --no-cache  构建时不使用缓存
    --pull      拉取最新基础镜像
    --logs      部署后显示日志
    --stop      停止服务
    --restart   重启服务
    --clean     清理未使用的镜像和容器
    --help      显示此帮助信息

示例:
    $0 production --build --logs
    $0 dev --no-cache
    $0 --stop
    $0 --clean

EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    # 检查权限
    if ! docker info &> /dev/null; then
        log_error "Docker 权限不足，请检查用户权限或 Docker 服务状态"
        exit 1
    fi

    log_success "系统依赖检查通过"
}

# 设置环境变量
setup_environment() {
    local env=${1:-production}

    log_info "设置 $env 环境..."

    # 复制环境配置文件
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_warning "已从 .env.example 创建 .env 文件，请根据需要修改配置"
        else
            log_error "缺少 .env.example 文件"
            exit 1
        fi
    fi

    # 根据环境设置变量
    case $env in
        dev|development)
            export ENVIRONMENT=development
            export LOG_LEVEL=DEBUG
            export PORT=8000
            ;;
        staging|test)
            export ENVIRONMENT=staging
            export LOG_LEVEL=INFO
            export PORT=8000
            ;;
        production|prod)
            export ENVIRONMENT=production
            export LOG_LEVEL=WARNING
            export PORT=8000
            ;;
        *)
            log_error "未知环境: $env"
            exit 1
            ;;
    esac

    log_success "环境设置完成: $ENVIRONMENT"
}

# 构建前端
build_frontend() {
    if [ "$FORCE_BUILD" = "true" ] || [ ! -d "frontend/dist" ]; then
        log_info "构建前端应用..."

        cd frontend
        npm ci --only=production
        npm run build
        cd ..

        log_success "前端构建完成"
    else
        log_info "前端已存在，跳过构建 (使用 --build 强制重建)"
    fi
}

# 构建 Docker 镜像
build_image() {
    local build_args=""

    if [ "$NO_CACHE" = "true" ]; then
        build_args="$build_args --no-cache"
    fi

    if [ "$PULL" = "true" ]; then
        build_args="$build_args --pull"
    fi

    if [ -n "$build_args" ] || [ "$FORCE_BUILD" = "true" ]; then
        log_info "构建 Docker 镜像..."
        docker-compose build $build_args
        log_success "镜像构建完成"
    else
        log_info "检查镜像是否存在..."
        if ! docker-compose images | grep -q "whoasr-app"; then
            log_info "镜像不存在，开始构建..."
            docker-compose build
            log_success "镜像构建完成"
        else
            log_info "镜像已存在，跳过构建"
        fi
    fi
}

# 启动服务
start_services() {
    log_info "启动服务..."

    # 根据环境启动不同的服务组合
    case $ENVIRONMENT in
        dev|development)
            docker-compose up -d whoasr-app
            ;;
        staging|test)
            docker-compose --profile cache up -d
            ;;
        production|prod)
            docker-compose --profile production --profile cache up -d
            ;;
    esac

    log_success "服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."

    # 等待应用启动
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:${PORT}/health &> /dev/null; then
            log_success "服务已就绪"
            return 0
        fi

        log_info "等待服务启动... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    log_error "服务启动超时"
    return 1
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    docker-compose down
    log_success "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    docker-compose restart
    log_success "服务已重启"
}

# 显示日志
show_logs() {
    log_info "显示服务日志..."
    docker-compose logs -f --tail=100
}

# 清理资源
cleanup_resources() {
    log_info "清理未使用的资源..."

    # 清理停止的容器
    docker container prune -f

    # 清理未使用的镜像
    docker image prune -f

    # 清理未使用的网络
    docker network prune -f

    # 清理未使用的卷 (谨慎操作)
    # docker volume prune -f

    log_success "资源清理完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    # 检查服务状态
    if ! docker-compose ps | grep -q "Up"; then
        log_error "服务未正常运行"
        return 1
    fi

    # 检查 HTTP 健康状态
    if curl -f http://localhost:${PORT}/health &> /dev/null; then
        log_success "健康检查通过"
        return 0
    else
        log_error "健康检查失败"
        return 1
    fi
}

# 主函数
main() {
    local environment="production"
    local action="deploy"

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|development|staging|test|production|prod)
                environment=$1
                shift
                ;;
            --build)
                export FORCE_BUILD=true
                shift
                ;;
            --no-cache)
                export NO_CACHE=true
                shift
                ;;
            --pull)
                export PULL=true
                shift
                ;;
            --logs)
                action="logs"
                shift
                ;;
            --stop)
                action="stop"
                shift
                ;;
            --restart)
                action="restart"
                shift
                ;;
            --clean)
                action="clean"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 显示标题
    echo "===================================="
    echo "whoAsr 部署脚本"
    echo "环境: $environment"
    echo "操作: $action"
    echo "时间: $(date)"
    echo "===================================="

    # 执行相应操作
    case $action in
        deploy)
            check_dependencies
            setup_environment $environment
            build_frontend
            build_image
            start_services
            wait_for_services
            health_check
            log_success "部署完成！"
            log_info "访问地址: http://localhost:${PORT}"
            ;;
        logs)
            show_logs
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        clean)
            cleanup_resources
            ;;
    esac
}

# 运行主函数
main "$@"