// api live stage URL

output "api_url" {
  value = aws_api_gateway_stage.this.invoke_url
}
