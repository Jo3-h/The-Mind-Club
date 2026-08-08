// The Mind Club Project

locals {
    common_tags = {
        "project" = "the-mind-club"
    }
}

module "ecr_repos" {
    source = "./modules/ecr_repos"
    tags   = merge(local.common_tags, { service = "ecr_repos"})
}

module "client" {
    source = "./modules/client"
    image  = var.client_image
    tags   = merge(local.common_tags, { service = "client"})
}