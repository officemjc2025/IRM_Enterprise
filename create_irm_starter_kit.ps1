# IRM Starter Kit Folder Structure
$folders = @(
"components",
"components/layout",
"components/ui",
"components/dashboard",
"features",
"features/auth",
"features/dashboard",
"features/property",
"features/resident",
"features/rental",
"features/maintenance",
"features/visitor",
"features/security",
"features/finance",
"lib",
"services",
"hooks",
"contexts",
"types",
"utils",
"styles",
"public/logo",
"public/images",
"public/icons"
)

foreach($f in $folders){
    New-Item -ItemType Directory -Force -Path $f | Out-Null
}

$files = @(
"components/layout/MainLayout.tsx",
"components/layout/Sidebar.tsx",
"components/layout/Header.tsx",
"components/layout/Footer.tsx",
"components/dashboard/KpiCard.tsx",
"components/dashboard/RecentActivity.tsx",
"components/ui/Loading.tsx",
"components/ui/PageTitle.tsx",
"lib/supabase.ts",
"lib/constants.ts",
"lib/auth.ts",
"services/api.ts",
"hooks/useAuth.ts",
"contexts/AuthContext.tsx",
"types/index.ts",
"utils/helpers.ts",
"styles/theme.css"
)

foreach($file in $files){
    if(!(Test-Path $file)){
        New-Item -ItemType File -Path $file | Out-Null
    }
}

Write-Host "IRM Starter Kit created successfully."
