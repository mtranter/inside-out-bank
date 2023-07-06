locals {
  catalog_scope = "https://catalog.inside-out-commerce.com/api.execute"
}

module "cloudfront_s3_website_with_domain" {
  source             = "chgangaraju/cloudfront-s3-website/aws"
  version            = "1.2.5"
  hosted_zone        = var.hosted_zone_name
  domain_name        = "${var.subdomain}.${var.hosted_zone_name}"
  upload_sample_file = false

  providers = {
    aws = aws
  }
}

data "aws_acm_certificate" "acm_cert" {
  domain   = "*.${var.hosted_zone_name}"
  provider = aws.us
  statuses = [
    "ISSUED",
  ]
}

module "cdn" {
  source = "cloudposse/cloudfront-s3-cdn/aws"

  version           = "0.90.0"
  namespace         = var.project_name
  stage             = var.environment
  name              = var.service_name
  aliases           = ["${var.subdomain}.${var.hosted_zone_name}"]
  dns_alias_enabled = true
  parent_zone_name  = var.hosted_zone_name
  cloudfront_access_logging_enabled = false

  acm_certificate_arn = data.aws_acm_certificate.acm_cert.arn
}

data "aws_cognito_user_pools" "this" {
  name = "${var.project_name}-${var.environment}"
}

resource "aws_cognito_user_pool_client" "userpool_client" {
  name                                 = "client"
  user_pool_id                         = data.aws_cognito_user_pools.this.ids[0]
  callback_urls                        = ["https://${var.subdomain}.${var.hosted_zone_name}", "http://localhost:3000"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", local.catalog_scope]
  supported_identity_providers         = ["COGNITO"]
}
