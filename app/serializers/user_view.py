from app.serializers.base import JsonView


class UserView(JsonView):
    """The signed-in user, as the account menu needs it. Never includes the token."""

    def render(self, user) -> dict:
        return {"id": user.id, "email": user.email, "name": user.name}
