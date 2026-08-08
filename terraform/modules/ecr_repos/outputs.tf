output "client_arn" {
  description = "Client ECR Repo ARN"
  value = aws_ecr_repository.client.arn
}