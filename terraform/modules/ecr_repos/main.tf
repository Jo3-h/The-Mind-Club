resource "aws_ecr_repository" "client" {
  name                 = "client-${terraform.workspace}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}