variable "tags" {
  description = "Tags to append to all resources in 'ecr_repos' module"
  type = map(string)
  default = {}
}