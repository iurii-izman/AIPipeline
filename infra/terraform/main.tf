locals {
  deployment_contract = {
    environment           = var.environment
    deploy_webhook_url    = var.deploy_webhook_url
    deploy_webhook_token  = var.deploy_webhook_token
    status_auth_token     = var.status_auth_token
    model_classifier_mode = var.model_classifier_mode
    model_kill_switch     = var.model_kill_switch
  }
}

resource "terraform_data" "deploy_contract" {
  input = {
    environment             = local.deployment_contract.environment
    deploy_webhook_url_set  = length(local.deployment_contract.deploy_webhook_url) > 0
    deploy_webhook_token_set = length(local.deployment_contract.deploy_webhook_token) > 0
    status_auth_token_set  = length(local.deployment_contract.status_auth_token) > 0
    model_classifier_mode  = local.deployment_contract.model_classifier_mode
    model_kill_switch      = local.deployment_contract.model_kill_switch
  }
}
