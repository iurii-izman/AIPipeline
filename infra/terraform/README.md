# Terraform Baseline (Staging/Production)

Цель: зафиксировать IaC deployment contract для staging/prod в виде валидируемой Terraform конфигурации.

## Структура

- `versions.tf` — версия Terraform.
- `variables.tf` — контракт обязательных параметров deployment.
- `main.tf` — baseline ресурс `terraform_data.deploy_contract`.
- `outputs.tf` — summary output для проверки.
- `environments/*/terraform.tfvars.example` — env-specific примеры.

## Локальная проверка

```bash
./scripts/check-iac-baseline.sh
```

## Примечания

- Секреты не хранятся в репозитории; значения берутся из keyring/runtime.
- Это baseline для следующего шага: расширение до полноценного provisioning модуля.
