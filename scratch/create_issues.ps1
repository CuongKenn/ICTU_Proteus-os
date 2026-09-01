# Create all 15 issues on GitHub
$repo = "CuongKenn/ICTU_Proteus-os"
$assignee = "CuongKenn"
$basePath = "scratch/issue_bodies"

$issues = @(
    @{ title = "[Security][Critical] SQL Injection Risk trong plugin_install.py va plugin_uninstall.py"; file = "issue01.md"; labels = "bug" },
    @{ title = "[Security][Critical] Schema/Tenant SQL context thieu parameterized statement"; file = "issue02.md"; labels = "bug" },
    @{ title = "[Architecture][High] Hexagonal Architecture Violation - Use Cases import truc tiep Adapters"; file = "issue03.md"; labels = "enhancement" },
    @{ title = "[Architecture][High] Thieu Abstract Port/Interface cho EventBus, Mattermost, N8n adapters"; file = "issue04.md"; labels = "enhancement" },
    @{ title = "[Bug][Critical] plugins.py router import PluginStatus tu module khong ton tai"; file = "issue05.md"; labels = "bug" },
    @{ title = "[Bug][Critical] Background task import async_session_maker khong ton tai"; file = "issue06.md"; labels = "bug" },
    @{ title = "[Architecture][High] AICommandUseCase import Schema tu Entrypoints - vi pham Dependency Rule"; file = "issue07.md"; labels = "enhancement" },
    @{ title = "[Security][High] Thieu Rate Limiting tren API /plugins/synthesize (AI endpoint)"; file = "issue08.md"; labels = "enhancement" },
    @{ title = "[Quality][Medium] Test Coverage rat thap - Can bo sung test cho Plugin Install/Uninstall"; file = "issue09.md"; labels = "enhancement" },
    @{ title = "[Improvement][Medium] Event Bus Redis Pub/Sub khong co persistence - Can Dead Letter Queue"; file = "issue10.md"; labels = "enhancement" },
    @{ title = "[Quality][Medium] Frontend - Thieu Error Boundary cho AIChatWidget"; file = "issue11.md"; labels = "enhancement" },
    @{ title = "[DevOps][High] Docker Compose Keycloak dung start-dev mode - khong an toan cho production"; file = "issue12.md"; labels = "enhancement" },
    @{ title = "[DevOps][Medium] Thieu Database Migration scripts (Alembic versions trong)"; file = "issue13.md"; labels = "enhancement" },
    @{ title = "[CodeQuality][Low] MattermostAdapter.send_interactive_message thieu type hint"; file = "issue14.md"; labels = "enhancement" },
    @{ title = "[CodeQuality][Low] Plugin Use Cases truy cap private attribute _plugins_dir"; file = "issue15.md"; labels = "enhancement" }
)

foreach ($issue in $issues) {
    Write-Host "Creating: $($issue.title)"
    gh issue create --repo $repo --title "$($issue.title)" --body-file "$basePath/$($issue.file)" --assignee $assignee --label "$($issue.labels)"
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Done! All issues created."
