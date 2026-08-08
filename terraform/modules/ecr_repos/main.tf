resource "aws_ecr_repository" "client" {
    name = "client"
    tags = var.tags
}