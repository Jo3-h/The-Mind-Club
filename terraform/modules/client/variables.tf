variable "tags" {
  description = "Tags to append to all resources in 'client' module"
  type = map(string)
  default = {}
}

variable "image" {
  description = "Client container image URI (e.g., ECR repo URI with tag or digest)"
  type = string
}