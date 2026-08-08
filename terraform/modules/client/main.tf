data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]  # trusted by the task runtime, not the ECS service itself
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "mcs-ecs-execution-${terraform.workspace}"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_service_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs.amazonaws.com"]  # note: different principal than execution role
    }
  }
}

resource "aws_iam_role" "infrastructure" {
  name               = "mm-ecs-infrastructure-${terraform.workspace}"
  assume_role_policy = data.aws_iam_policy_document.ecs_service_assume.json
}

resource "aws_iam_role_policy_attachment" "infrastructure_managed" {
  role       = aws_iam_role.infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices"
}

resource "aws_ecs_express_gateway_service" "client" {
    service_name = "mm-ecs-${terraform.workspace}"
    execution_role_arn = aws_iam_role.execution.arn
    infrastructure_role_arn = aws_iam_role.infrastructure.arn
    
    # container configuration
    primary_container {
      image = var.image
    }
    
    tags = var.tags
}